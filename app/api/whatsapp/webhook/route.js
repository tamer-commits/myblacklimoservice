import { NextResponse } from 'next/server';
import {
 dbConfigured,
 getWhatsAppIntake,
 upsertWhatsAppIntake,
 resetWhatsAppIntake,
 insertBooking,
} from '../../../../lib/db';
import { startEmailOtp, verifyEmailOtp } from '../../../../lib/otp';
import { AIRPORT_RX } from '../../quote/route';

// Twilio's WhatsApp inbound webhook. Configure this URL in Twilio Console >
// Messaging > Senders > (your WhatsApp sender) > "WHEN A MESSAGE COMES IN"
// as an HTTP POST to https://www.myblacklimoservice.com/api/whatsapp/webhook
// — see the project notes for why no WhatsApp sender exists yet.
//
// This is an intake/hand-off bot, not a live-priced booking bot: it asks the
// mandatory booking questions one at a time, verifies the customer's email
// with the same 6-digit OTP flow already used on the website, then creates a
// booking row with status AWAITING_MANUAL_QUOTE and source 'whatsapp' for a
// human (Tamer/staff) to price and confirm manually. Nothing here quotes a
// fare or takes a payment.
//
// State machine: whatsapp_intakes.state tracks which question we're waiting
// on an answer for. Each inbound message either (a) starts a brand-new
// session (send the greeting + first question, don't consume the message as
// an answer), (b) resets on a stale (24h+) or "restart" session, or (c) is
// treated as the answer to the current question and advances one step.
//
// Replies are synchronous TwiML (<Response><Message>...</Message></Response>)
// — the standard, simplest way to reply from a Twilio WhatsApp webhook — not
// a separate outbound REST send. The email OTP code itself still goes out
// over a different channel (Resend, via lib/otp.js's startEmailOtp).

const RESTART_WORDS = new Set(['restart', 'start over', 'reset', 'startover', 'start again']);
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24h — a stale intake starts fresh rather than resuming
const SITE_PHONE = '+61 420 770 707';

function escapeXml(s){
 return String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');
}

function twiml(message){
 return new NextResponse(
  `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`,
  { status: 200, headers: { 'Content-Type': 'text/xml' } }
 );
}

function clean(v, max = 500){ return String(v ?? '').trim().slice(0, max); }
function isBlank(v){ return !v || !String(v).trim(); }
function isValidEmail(v){ return /^\S+@\S+\.\S+$/.test(String(v || '').trim()); }
function isSixDigitCode(v){ return /^\d{6}$/.test(String(v || '').trim()); }

function extractPassengers(text){
 const m = String(text || '').match(/\d+/);
 if(!m) return null;
 const n = parseInt(m[0], 10);
 if(!Number.isFinite(n) || n < 1 || n > 24) return null;
 return n;
}

function newReference(){
 return `MBL-${Date.now().toString().slice(-8)}`;
}

// Whether the trip needs a flight number — reuses the exact same airport
// detection as the web quote/booking flow (app/api/quote/route.js) so the
// two never drift apart.
function needsFlight(intake){
 return AIRPORT_RX.test(intake.origin || '') || AIRPORT_RX.test(intake.destination || '');
}

function nextAfterEmailState(intake){
 return needsFlight(intake) ? 'ASK_FLIGHT' : 'DONE';
}

function questionFor(state, intake){
 switch(state){
  case 'ASK_NAME':
   return "Hi! Thanks for messaging My Black Limo Service 🚘 Let's get your booking request started.\n\nWhat's your full name?";
  case 'ASK_ORIGIN':
   return `Thanks${intake.name ? ', ' + intake.name : ''}! Where would you like to be picked up from? (address or suburb)`;
  case 'ASK_DESTINATION':
   return 'And where are you headed?';
  case 'ASK_DATETIME':
   return 'What date and time would you like the pickup? (e.g. "Friday 26 Sept, 6:30am")';
  case 'ASK_PASSENGERS_VEHICLE':
   return 'How many passengers, and any vehicle preference? (e.g. "3 passengers, S-Class" — reply "no preference" if unsure)';
  case 'ASK_SECOND_PHONE':
   return 'Please share a second contact number we can reach you on — this is required for every booking.';
  case 'ASK_EMAIL':
   return "Lastly, what's your email address? We'll email you a 6-digit code to confirm it.";
  case 'ASK_EMAIL_OTP':
   return `We've emailed a 6-digit code to ${intake.email}. Please reply with that code. (Reply RESEND if you didn't get it.)`;
  case 'ASK_FLIGHT':
   return "Since your trip involves Sydney Airport, what's your flight number? (Reply SKIP if you don't have one.)";
  default:
   return null;
 }
}

// Persists the finished intake as a real booking row and closes out the
// conversation. `pickupAt` is a placeholder far outside the dispatch cron's
// lookback/lookahead window (now-2h..now+25h in lib/db.js#getUpcomingBookings)
// on purpose: this booking has no real, confirmed pickup time yet — the
// customer only gave free text (pickup_at_text) — so it must never be swept
// up by the automated driver-assignment/reminder flow in lib/dispatch.js.
// Staff replace pickup_at with the real time once they've called the
// customer with a price and locked in a booking.
async function finalizeBooking(phone, intake){
 const notesParts = [`Requested pickup: ${intake.pickup_at_text || 'not specified'}`];
 if(intake.vehicle_preference) notesParts.push(`Passengers/vehicle preference: ${intake.vehicle_preference}`);
 notesParts.push('(submitted via WhatsApp intake bot)');
 const notes = notesParts.join('\n');

 const pickupAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

 const booking = await insertBooking({
  reference: newReference(),
  userId: null,
  name: intake.name,
  email: intake.email,
  phone,
  secondPhone: intake.second_phone,
  flightNumber: intake.flight_number || null,
  origin: intake.origin,
  destination: intake.destination,
  pickupAt,
  vehicle: null,
  passengers: intake.passengers || null,
  notes,
  quotedFare: null,
  status: 'AWAITING_MANUAL_QUOTE',
  driverId: null,
  source: 'whatsapp',
 });

 await upsertWhatsAppIntake(phone, { state: 'DONE', booking_id: booking.id });

 return twiml(
  `Thank you — your request is with the My Black Limo Service team. We'll be in touch shortly with your price. (Ref ${booking.reference})`
 );
}

export async function POST(req){
 try{
  if(!dbConfigured()){
   return twiml(`Sorry — our booking system is temporarily unavailable. Please call ${SITE_PHONE}.`);
  }

  const form = await req.formData();
  const fromRaw = String(form.get('From') || '');
  const bodyRaw = String(form.get('Body') || '');
  const body = bodyRaw.trim();
  const lowerBody = body.toLowerCase();

  if(!fromRaw.startsWith('whatsapp:')){
   return twiml('This number only accepts WhatsApp messages.');
  }
  const phone = fromRaw.replace('whatsapp:', '').trim(); // customer's E.164 WhatsApp number
  if(!phone){
   return twiml('Sorry, something went wrong reading your number. Please try again.');
  }

  // Load or start the intake session, resetting a stale (24h+) one rather
  // than resuming it — see SESSION_TIMEOUT_MS above.
  let intake = await getWhatsAppIntake(phone);
  let isNewSession = false;
  if(!intake){
   intake = await upsertWhatsAppIntake(phone, { state: 'ASK_NAME' });
   isNewSession = true;
  } else {
   const ageMs = Date.now() - new Date(intake.updated_at).getTime();
   if(ageMs > SESSION_TIMEOUT_MS){
    intake = await resetWhatsAppIntake(phone);
    isNewSession = true;
   }
  }

  if(RESTART_WORDS.has(lowerBody)){
   intake = await resetWhatsAppIntake(phone);
   return twiml(`No problem — let's start over.\n\n${questionFor('ASK_NAME', intake)}`);
  }

  if(intake.state === 'DONE'){
   return twiml(
    `Your booking request${intake.booking_id ? '' : ''} is already with our team — we'll be in touch shortly. Reply RESTART if you'd like to submit a new request.`
   );
  }

  if(isNewSession){
   return twiml(questionFor('ASK_NAME', intake));
  }

  if(isBlank(body)){
   return twiml(`Sorry, I didn't catch that. ${questionFor(intake.state, intake)}`);
  }

  switch(intake.state){
   case 'ASK_NAME': {
    if(body.length < 2) return twiml("That doesn't look like a full name — could you send it again?");
    intake = await upsertWhatsAppIntake(phone, { name: clean(body, 100), state: 'ASK_ORIGIN' });
    return twiml(questionFor('ASK_ORIGIN', intake));
   }

   case 'ASK_ORIGIN': {
    if(body.length < 3) return twiml('Could you give a bit more detail on the pickup address or suburb?');
    intake = await upsertWhatsAppIntake(phone, { origin: clean(body, 250), state: 'ASK_DESTINATION' });
    return twiml(questionFor('ASK_DESTINATION', intake));
   }

   case 'ASK_DESTINATION': {
    if(body.length < 3) return twiml('Could you give a bit more detail on the destination?');
    intake = await upsertWhatsAppIntake(phone, { destination: clean(body, 250), state: 'ASK_DATETIME' });
    return twiml(questionFor('ASK_DATETIME', intake));
   }

   case 'ASK_DATETIME': {
    if(body.length < 3) return twiml("Sorry, could you resend the date and time you'd like pickup?");
    intake = await upsertWhatsAppIntake(phone, { pickup_at_text: clean(body, 200), state: 'ASK_PASSENGERS_VEHICLE' });
    return twiml(questionFor('ASK_PASSENGERS_VEHICLE', intake));
   }

   case 'ASK_PASSENGERS_VEHICLE': {
    intake = await upsertWhatsAppIntake(phone, {
     vehicle_preference: clean(body, 250),
     passengers: extractPassengers(body),
     state: 'ASK_SECOND_PHONE',
    });
    return twiml(questionFor('ASK_SECOND_PHONE', intake));
   }

   case 'ASK_SECOND_PHONE': {
    if(body.replace(/\D/g, '').length < 6) return twiml("That doesn't look like a valid phone number — could you resend it?");
    intake = await upsertWhatsAppIntake(phone, { second_phone: clean(body, 40), state: 'ASK_EMAIL' });
    return twiml(questionFor('ASK_EMAIL', intake));
   }

   case 'ASK_EMAIL': {
    if(!isValidEmail(body)) return twiml("That doesn't look like a valid email address — could you resend it?");
    const email = clean(body, 160).toLowerCase();
    intake = await upsertWhatsAppIntake(phone, { email, state: 'ASK_EMAIL_OTP' });
    const sent = await startEmailOtp(email, 'whatsapp_email');
    if(!sent.ok && sent.reason !== 'cooldown'){
     // Soft-fail: don't block the whole intake on an email-sending outage —
     // move on without a verified email rather than leaving the customer
     // stuck talking to a bot that can no longer send codes. Staff can
     // confirm the email by phone when they call with the price.
     const fallbackState = nextAfterEmailState(intake);
     intake = await upsertWhatsAppIntake(phone, { state: fallbackState });
     const followUp = fallbackState === 'DONE' ? null : questionFor(fallbackState, intake);
     if(fallbackState === 'DONE') return await finalizeBooking(phone, intake);
     return twiml(
      `We couldn't send a verification email right now, so we'll skip that step — our team will confirm your email when they call.\n\n${followUp}`
     );
    }
    return twiml(questionFor('ASK_EMAIL_OTP', intake));
   }

   case 'ASK_EMAIL_OTP': {
    if(lowerBody === 'resend'){
     const sent = await startEmailOtp(intake.email, 'whatsapp_email');
     if(!sent.ok){
      if(sent.reason === 'cooldown') return twiml(`Please wait about ${sent.retryInSeconds}s before requesting another code.`);
      return twiml("We couldn't resend the code right now — please try again shortly, or reply with the code if you already have one.");
     }
     return twiml('Sent! Please reply with the new 6-digit code.');
    }
    if(!isSixDigitCode(body)){
     return twiml('Please reply with the 6-digit code we emailed you, or reply RESEND for a new one.');
    }
    const result = await verifyEmailOtp(intake.email, 'whatsapp_email', body.trim());
    if(!result.ok){
     const msgs = {
      incorrect: "That code didn't match — please try again, or reply RESEND for a new one.",
      expired: 'That code has expired — reply RESEND to get a new one.',
      too_many_attempts: 'Too many incorrect attempts — reply RESEND to get a new code.',
      no_code: "We don't have a pending code for you — reply RESEND to get one.",
     };
     return twiml(msgs[result.reason] || "We couldn't verify that code — reply RESEND to try again.");
    }
    const nextState = nextAfterEmailState(intake);
    intake = await upsertWhatsAppIntake(phone, { email_verified_at: new Date().toISOString(), state: nextState });
    if(nextState === 'DONE') return await finalizeBooking(phone, intake);
    return twiml(questionFor(nextState, intake));
   }

   case 'ASK_FLIGHT': {
    const flight = ['skip', 'none', 'n/a', 'na'].includes(lowerBody) ? null : clean(body, 20);
    intake = await upsertWhatsAppIntake(phone, { flight_number: flight, state: 'DONE' });
    return await finalizeBooking(phone, intake);
   }

   default: {
    intake = await resetWhatsAppIntake(phone);
    return twiml(`Something went wrong on our end — let's start over.\n\n${questionFor('ASK_NAME', intake)}`);
   }
  }
 }catch(e){
  console.error('WHATSAPP_WEBHOOK_ERROR', e);
  return twiml(`Sorry, something went wrong on our end. Please try again in a moment, or call ${SITE_PHONE}.`);
 }
}

// Lets a browser/health-check hitting this URL directly get a sane response
// instead of a 405 — Twilio itself always calls POST.
export async function GET(){
 return NextResponse.json({ ok: true, note: 'This endpoint accepts POST requests from Twilio (WhatsApp inbound webhook).' });
}
