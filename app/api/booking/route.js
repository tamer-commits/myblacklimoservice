import { NextResponse } from 'next/server';
import { dbConfigured, insertBooking, getUserById } from '../../../lib/db';
import { runDispatchForBooking, sendCustomerBookingConfirmation } from '../../../lib/dispatch';
import { sydneyLocalToUtc } from '../../../lib/time';
import { toE164 } from '../../../lib/notify';
import { getSessionFromRequest, verifyVerificationToken } from '../../../lib/session';
import { AIRPORT_RX } from '../quote/route';

function clean(v,max=500){return String(v??'').trim().slice(0,max)}
async function createSquareCheckout(booking){
 const token=process.env.SQUARE_ACCESS_TOKEN,locationId=process.env.SQUARE_LOCATION_ID;
 if(!token||!locationId) return null;
 const sandbox=(process.env.SQUARE_ENVIRONMENT||'production').toLowerCase()==='sandbox';
 const host=sandbox?'https://connect.squareupsandbox.com':'https://connect.squareup.com';
 const site=(process.env.NEXT_PUBLIC_SITE_URL||'https://www.myblacklimoservice.com').replace(/\/$/,'');
 const r=await fetch(`${host}/v2/online-checkout/payment-links`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Square-Version':'2026-08-19','Content-Type':'application/json'},body:JSON.stringify({idempotency_key:`${booking.reference}-${Date.now()}`,quick_pay:{name:`MBLS ${booking.vehicle} chauffeur booking ${booking.reference}`,price_money:{amount:Math.round(booking.quotedFare*100),currency:'AUD'},location_id:locationId},checkout_options:{redirect_url:`${site}/booking-confirmed?ref=${encodeURIComponent(booking.reference)}`},pre_populated_data:{buyer_email:booking.email,buyer_phone_number:booking.phone},payment_note:`${booking.reference}: ${booking.origin} to ${booking.destination} on ${booking.date} ${booking.time}`})});
 const d=await r.json(); if(!r.ok) throw new Error(d.errors?.[0]?.detail||'Square checkout could not be created.');
 return d.payment_link?.url||d.payment_link?.long_url||null;
}

// Persists the booking and kicks off the driver/customer notification
// workflow. Runs after the response-critical Square step and is entirely
// best-effort: if Postgres isn't provisioned yet (dbConfigured() === false)
// or anything here throws, the booking request itself still succeeds exactly
// as it did before — this only adds capability, it never removes it.
async function persistAndDispatch(booking){
 if(!dbConfigured()) return null;
 try{
  const pickupAt = sydneyLocalToUtc(booking.date, booking.time);
  const row = await insertBooking({
   reference: booking.reference,
   userId: booking.userId,
   name: booking.name,
   email: booking.email,
   phone: booking.phone,
   secondPhone: booking.secondPhone,
   flightNumber: booking.flightNumber,
   origin: booking.origin,
   destination: booking.destination,
   pickupAt,
   vehicle: booking.vehicle,
   passengers: booking.passengers,
   notes: booking.notes,
   quotedFare: booking.quotedFare,
   status: booking.status,
  });
  await sendCustomerBookingConfirmation(row);
  const results = await runDispatchForBooking(row);
  return { bookingId: row.id, results };
 }catch(e){
  console.error('PERSIST_AND_DISPATCH_FAILED', booking.reference, e.message);
  return { error: e.message };
 }
}

// Mandatory-field / verification policy (whether the customer is logged in
// or booking as a guest): destination, primary phone (OTP-verified),
// second phone (never OTP-verified), and email (OTP-verified) are always
// required. Flight number is required only when the trip involves a Sydney
// Airport pickup or drop-off. A logged-in account whose phone/email are
// already verified from signup skips re-verification at booking time and
// just reuses those; a guest (or a logged-in customer entering a different
// email/phone than their account's) must prove a fresh OTP check via
// /api/otp/start + /api/otp/check (purpose 'booking_email'/'booking_phone'),
// whose short-lived signed token is submitted here as
// emailVerifyToken/phoneVerifyToken.
export async function POST(req){
 try{
  const raw=await req.json();
  const b={name:clean(raw.name,100),email:clean(raw.email,160),phone:clean(raw.phone,40),secondPhone:clean(raw.secondPhone,40),flightNumber:clean(raw.flightNumber,20),origin:clean(raw.origin,250),destination:clean(raw.destination,250),date:clean(raw.date,20),time:clean(raw.time,20),vehicle:clean(raw.vehicle,40),passengers:Math.max(1,Math.min(24,Number(raw.passengers)||1)),baby:Math.max(0,Number(raw.baby)||0),booster:Math.max(0,Number(raw.booster)||0),meet:Boolean(raw.meet),returnTrip:Boolean(raw.returnTrip),notes:clean(raw.notes,1000),quotedFare:Math.max(0,Number(raw.quotedFare)||0),routeKm:Math.max(0,Number(raw.routeKm)||0),routeMinutes:Math.max(0,Number(raw.routeMinutes)||0)};

  if(!b.name||!b.email||!b.phone||!b.secondPhone||!b.origin||!b.destination||!b.date||!b.time) return NextResponse.json({error:'Please complete your contact, date, time and journey details, including a second phone number.'},{status:400});
  if(!/^\S+@\S+\.\S+$/.test(b.email)) return NextResponse.json({error:'Please enter a valid email address.'},{status:400});
  if(!b.quotedFare||!b.routeKm) return NextResponse.json({error:'Please calculate the live route before booking.'},{status:400});

  const airportInvolved = AIRPORT_RX.test(b.origin) || AIRPORT_RX.test(b.destination);
  if(airportInvolved && !b.flightNumber) return NextResponse.json({error:'Please provide your flight number — this trip involves a Sydney Airport pickup or drop-off.'},{status:400});

  const emailLower = b.email.toLowerCase();
  const phoneE164 = toE164(b.phone);

  let sessionUser = null;
  if(dbConfigured()){
   const session = getSessionFromRequest(req);
   if(session) sessionUser = await getUserById(session.userId);
  }

  const accountEmailVerified = Boolean(sessionUser && sessionUser.email_verified_at && sessionUser.email === emailLower);
  const accountPhoneVerified = Boolean(sessionUser && sessionUser.phone_verified_at && sessionUser.phone === phoneE164);

  if(!accountEmailVerified){
   const tok = verifyVerificationToken(String(raw.emailVerifyToken||''));
   if(!tok || tok.channel!=='email' || tok.purpose!=='booking_email' || tok.identifier!==emailLower){
    return NextResponse.json({error:'Please verify your email address with the code we sent before booking.',code:'email_not_verified'},{status:400});
   }
  }
  if(!accountPhoneVerified){
   const tok = verifyVerificationToken(String(raw.phoneVerifyToken||''));
   if(!tok || tok.channel!=='phone' || tok.purpose!=='booking_phone' || tok.identifier!==phoneE164){
    return NextResponse.json({error:'Please verify your mobile number with the code we sent before booking.',code:'phone_not_verified'},{status:400});
   }
  }

  const reference=`MBL-${Date.now().toString().slice(-8)}`,receivedAt=new Date().toISOString();
  const booking={reference,status:'AWAITING_PAYMENT',...b,userId: sessionUser?.id || null,receivedAt};
  let paymentUrl=null,paymentError=null;
  try{paymentUrl=await createSquareCheckout(booking)}catch(e){paymentError=e.message;console.error('SQUARE_CHECKOUT_ERROR',reference,e)}
  if(!paymentUrl) booking.status='AWAITING_MANUAL_CONFIRMATION';
  console.log('BOOKING_REQUEST',booking);
  const dispatch = await persistAndDispatch(booking);
  if (dispatch?.error) console.error('DISPATCH_SUMMARY_ERROR', reference, dispatch.error);
  else if (dispatch) console.log('DISPATCH_SUMMARY', reference, dispatch.results?.map(r=>`${r.action}:${r.ok}`).join(', '));
  return NextResponse.json({ok:true,reference,status:booking.status,amount:b.quotedFare,currency:'AUD',paymentUrl,paymentReady:Boolean(paymentUrl),paymentError:paymentUrl?null:paymentError,message:paymentUrl?'Booking created. Continue to secure payment to confirm your request.':'Your booking request has been received. We will contact you to confirm it.'});
 }catch(e){console.error(e);return NextResponse.json({error:'Unable to submit booking request.'},{status:500});}
}
