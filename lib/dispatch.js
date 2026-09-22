// Pure escalation logic + the message copy for the driver/customer
// notification workflow, plus the executor that carries an action out and
// records it on the booking row. Kept separate from the API routes so both
// the booking-creation route (fires the first checkpoint immediately) and
// the cron route (fires every subsequent checkpoint every 5 minutes) share
// one source of truth — a booking can never be double-sent because every
// action is gated on its own *_sent_at / *_confirmed_at column being null.
//
// --- Checkpoint timeline -----------------------------------------------
// DRIVER side (per assigned driver):
//   T-24h   send_driver_24h            — ask driver to confirm (plain link)
//   T-90m   send_driver_90m            — ask driver to confirm (slide-confirm)
//   T-75m   call_driver_75m            — if still unconfirmed, automated call
//                                          + resend the 90m text
//   T-50m   reassign_50m               — FINAL opportunity: if still
//                                          unconfirmed, reassign to a
//                                          different active driver and send
//                                          them an urgent slide-confirm
//                                          immediately (no waiting for the
//                                          normal cadence). No backup driver
//                                          available => immediate management
//                                          alert (needs_manual_dispatch).
//   +15min  escalate_driver_unconfirmed — bounded follow-up: if the NEWLY
//            after reassign                reassigned driver also hasn't
//                                          confirmed ~15 minutes later,
//                                          stop trying to reassign again and
//                                          alert management instead.
//
// CUSTOMER side (per booking):
//   T-48h   customer_confirm_48h — slide-confirm request if not yet confirmed
//   T-24h   customer_confirm_24h — slide-confirm request if still unconfirmed,
//                                   otherwise a light "see you soon" reminder
//   T-2h    customer_confirm_2h  — same as above, last customer-facing nudge
//   T-1h    customer_escalate_unconfirmed — if STILL unconfirmed with the
//                                   driver about to be en route, alert
//                                   management to call the customer directly
//
// Every escalation ("needs manual dispatch") sets needs_manual_dispatch=true
// AND appends a short machine-readable reason to manual_dispatch_reason, so
// the admin UI can show *why* a booking needs attention at a glance. Driver-
// side and customer-side problems are tracked independently
// (driver_manual_dispatch_at / customer_manual_dispatch_at) so one kind of
// problem being flagged never masks or blocks detection of the other kind.

import { sql, updateBooking, flagManualDispatch, pickNextDriver, issueDriverConfirmToken, issueCustomerConfirmToken, getActiveDrivers } from './db';
import { sendWhatsAppAndSms, sendSms, callDriver } from './notify';
import { sendEmail } from './email';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.myblacklimoservice.com').replace(/\/$/, '');

// Named, defaultable alert recipient — Tamer's own mobile unless he sets his
// own value in Vercel. Falls back to the older DISPATCH_ALERT_PHONE env var
// if that's the only one set, so nothing already configured stops working.
const ADMIN_ALERT_PHONE = process.env.ADMIN_ALERT_PHONE || process.env.DISPATCH_ALERT_PHONE || '+61420770707';

function adminEmailList(){
 const raw = process.env.ADMIN_EMAILS || '';
 return raw.split(',').map(e => e.trim()).filter(Boolean);
}

// Fires the SAME urgent alert on two independent channels (SMS + email) —
// redundancy in the alert channel itself, since a missed alert here means a
// real driver or customer gets stranded. Best-effort on every recipient:
// one failing send never stops the others.
async function alertManagement({ subject, smsBody, htmlBody }){
 const jobs = [];
 if (ADMIN_ALERT_PHONE) {
  jobs.push(sendSms(ADMIN_ALERT_PHONE, smsBody).catch(e => ({ sent:false, reason:e.message })));
 }
 for (const to of adminEmailList()) {
  jobs.push(sendEmail({
   to,
   subject,
   html: htmlBody || `<div style="font-family:Arial,Helvetica,sans-serif;white-space:pre-wrap;max-width:560px">${smsBody.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</div>`,
   text: smsBody,
  }).catch(e => ({ ok:false, reason:e.message })));
 }
 return Promise.allSettled(jobs);
}

function formatWhen(pickupAt){
 try{
  return new Date(pickupAt).toLocaleString('en-AU', { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit', timeZone:'Australia/Sydney' });
 }catch{ return String(pickupAt); }
}

function driverConfirmLink(token){
 return `${SITE}/driver-confirm?token=${token}`;
}

function customerConfirmLink(token){
 return `${SITE}/booking-confirm?token=${token}`;
}

function adminBookingLink(booking){
 return `${SITE}/admin/bookings/${booking.id}`;
}

// Given a booking row (as returned from Postgres — snake_case, Date objects
// for timestamptz columns) and "now", return the list of checkpoint actions
// that are due but not yet actioned. Pure — no I/O, easy to unit-reason about.
export function computeDueActions(booking, now = new Date()){
 const actions = [];
 if (booking.status === 'CANCELLED') return actions;

 const pickupAt = new Date(booking.pickup_at);
 const minutesToPickup = (pickupAt.getTime() - now.getTime()) / 60000;
 if (minutesToPickup < -30) return actions; // job has departed, nothing left to chase

 if (!booking.driver_id) {
  actions.push('assign_driver');
  return actions; // nothing else makes sense without a driver on the job
 }

 // --- Driver checkpoints -------------------------------------------------
 if (!booking.driver_confirm_24h_sent_at && !booking.driver_confirmed_24h_at && minutesToPickup <= 24 * 60) {
  actions.push('send_driver_24h');
 }

 if (!booking.driver_confirm_90m_sent_at && minutesToPickup <= 90) {
  actions.push('send_driver_90m');
 }

 if (!booking.driver_confirmed_90m_at && booking.driver_confirm_90m_sent_at && !booking.driver_call_75m_sent_at && minutesToPickup <= 75) {
  actions.push('call_driver_75m');
 }

 // Final opportunity to confirm the ORIGINAL driver is 50 minutes before
 // pickup, per spec — after this we reassign rather than keep waiting.
 if (!booking.driver_confirmed_90m_at && !booking.reassigned_50m_at && !booking.driver_manual_dispatch_at && minutesToPickup <= 50) {
  actions.push('reassign_50m');
 }

 // Bounded follow-up: give the newly-reassigned driver ~15 minutes to
 // confirm; if they also don't, stop reassigning and escalate to management
 // instead of chasing a third/fourth driver against a shrinking clock.
 if (booking.reassigned_50m_at && !booking.driver_confirmed_90m_at && !booking.driver_manual_dispatch_at) {
  const minutesSinceReassign = (now.getTime() - new Date(booking.reassigned_50m_at).getTime()) / 60000;
  if (minutesSinceReassign >= 15) {
   actions.push('escalate_driver_unconfirmed');
  }
 }

 // --- Customer checkpoints ------------------------------------------------
 if (!booking.customer_confirmed_at && !booking.customer_confirm_48h_sent_at && minutesToPickup <= 48 * 60) {
  actions.push('customer_confirm_48h');
 }

 if (!booking.customer_confirm_24h_sent_at && minutesToPickup <= 24 * 60) {
  actions.push('customer_confirm_24h');
 }

 if (!booking.customer_confirm_2h_sent_at && minutesToPickup <= 120) {
  actions.push('customer_confirm_2h');
 }

 // Final deadline for the customer to confirm — 1 hour before pickup, so
 // management has a window to call them before the driver is en route.
 if (!booking.customer_confirmed_at && !booking.customer_manual_dispatch_at && minutesToPickup <= 60) {
  actions.push('customer_escalate_unconfirmed');
 }

 return actions;
}

async function sendDriverConfirmRequest(booking, stage, { urgent = false } = {}){
 const driver = { id: booking.driver_id, phone: booking.driver_phone, name: booking.driver_name };
 const token = await issueDriverConfirmToken({
  bookingId: booking.id,
  driverId: booking.driver_id,
  stage,
  expiresAt: new Date(new Date(booking.pickup_at).getTime() + 2 * 60 * 60 * 1000),
 });
 const label = stage === '24h' ? '24 hours' : stage === '90m' ? '90 minutes' : urgent ? 'MINUTES — final opportunity' : 'shortly';
 const prefix = urgent ? 'MBLS DISPATCH — URGENT REASSIGNMENT' : 'MBLS DISPATCH';
 const body = `${prefix} — ${driver.name}, please confirm you are on for pickup in ${label}.\nRef ${booking.reference}\n${formatWhen(booking.pickup_at)}\nPickup: ${booking.origin}\nDrop-off: ${booking.destination}\nVehicle: ${booking.vehicle || 'as booked'}\n\nConfirm now: ${driverConfirmLink(token)}`;
 return sendWhatsAppAndSms(driver.phone, body);
}

async function executeAssignDriver(booking){
 const driver = await pickNextDriver();
 if (!driver) {
  const alreadyAlerted = Boolean(booking.driver_manual_dispatch_at);
  await flagManualDispatch(booking.id, 'no_active_driver');
  if (!alreadyAlerted) {
   await updateBooking(booking.id, { driver_manual_dispatch_at: new Date() });
   await alertManagement({
    subject: `MBLS — no driver available for ${booking.reference}`,
    smsBody: `MBLS ALERT — no active driver available for ${booking.reference} (${formatWhen(booking.pickup_at)}). Customer ${booking.name} ${booking.phone}. Manual dispatch required. ${adminBookingLink(booking)}`,
   });
  }
  return { action:'assign_driver', ok:false, reason:'no_active_driver' };
 }
 await updateBooking(booking.id, { driver_id: driver.id });
 return { action:'assign_driver', ok:true, driverId: driver.id };
}

async function executeSendDriver24h(booking){
 const result = await sendDriverConfirmRequest(booking, '24h');
 await updateBooking(booking.id, { driver_confirm_24h_sent_at: new Date() });
 return { action:'send_driver_24h', ok: Boolean(result.whatsapp.sent || result.sms.sent), result };
}

async function executeSendDriver90m(booking){
 const result = await sendDriverConfirmRequest(booking, '90m');
 await updateBooking(booking.id, { driver_confirm_90m_sent_at: new Date() });
 return { action:'send_driver_90m', ok: Boolean(result.whatsapp.sent || result.sms.sent), result };
}

async function executeCallDriver75m(booking){
 const spoken = `My Black Limo Service dispatch calling. This is a required confirmation for booking reference ${booking.reference.split('').join(' ')}, pickup at ${formatWhen(booking.pickup_at)}. Please open your text message or WhatsApp and confirm the job now. If you cannot take this job, contact dispatch immediately.`;
 const call = await callDriver(booking.driver_phone, spoken);
 // Also re-send the text in case the call is missed — belt and braces.
 await sendDriverConfirmRequest(booking, '90m');
 await updateBooking(booking.id, { driver_call_75m_sent_at: new Date() });
 return { action:'call_driver_75m', ok: Boolean(call.sent), call };
}

// Final opportunity to confirm the original driver is 50 minutes before
// pickup. If they still haven't confirmed, reassign to a different active
// driver right now and send that driver an urgent, immediate slide-confirm
// request (not the normal cadence — pickup is close). If there is no other
// active driver at all, this is an immediate management alert.
async function executeReassign50m(booking){
 const nextDriver = await pickNextDriver({ excludeId: booking.driver_id });
 if (!nextDriver) {
  await flagManualDispatch(booking.id, 'no_backup_driver_at_50m');
  await updateBooking(booking.id, { reassigned_50m_at: new Date(), driver_manual_dispatch_at: new Date() });
  await alertManagement({
   subject: `MBLS — URGENT: no backup driver for ${booking.reference}`,
   smsBody: `MBLS ALERT — ${booking.driver_name || 'assigned driver'} did not confirm ${booking.reference} (${formatWhen(booking.pickup_at)}) and NO other active driver is available. Customer ${booking.name} ${booking.phone}. Manual dispatch required NOW. ${adminBookingLink(booking)}`,
  });
  return { action:'reassign_50m', ok:false, reason:'no_backup_driver' };
 }
 const previousDriverName = booking.driver_name || 'previous driver';
 await updateBooking(booking.id, {
  driver_id: nextDriver.id,
  reassigned_50m_at: new Date(),
  reassignment_count: (booking.reassignment_count || 0) + 1,
  driver_confirm_90m_sent_at: null,
  driver_confirmed_90m_at: null,
  driver_call_75m_sent_at: null,
 });
 const rebooked = { ...booking, driver_id: nextDriver.id, driver_phone: nextDriver.phone, driver_name: nextDriver.name };
 const result = await sendDriverConfirmRequest(rebooked, 'reassign_urgent', { urgent: true });
 await updateBooking(booking.id, { driver_confirm_90m_sent_at: new Date() });
 if (ADMIN_ALERT_PHONE) {
  await sendSms(ADMIN_ALERT_PHONE, `MBLS DISPATCH — ${booking.reference} reassigned from ${previousDriverName} to ${nextDriver.name} at T-50m (no confirmation). New driver sent an URGENT confirm request; will escalate if not confirmed within 15 min.`);
 }
 return { action:'reassign_50m', ok: Boolean(result.whatsapp.sent || result.sms.sent), driverId: nextDriver.id };
}

// Bounded follow-up: the reassigned driver also hasn't confirmed ~15 minutes
// later. Rather than reassigning again and again against a shrinking clock,
// stop and put a human in the loop immediately.
async function executeEscalateDriverUnconfirmed(booking){
 await flagManualDispatch(booking.id, 'driver_unconfirmed_after_reassignment');
 await updateBooking(booking.id, { driver_manual_dispatch_at: new Date() });
 await alertManagement({
  subject: `MBLS — URGENT: driver still hasn't confirmed ${booking.reference}`,
  smsBody: `MBLS ALERT — DRIVER HASN'T CONFIRMED. ${booking.reference} pickup ${formatWhen(booking.pickup_at)}. Reassigned driver ${booking.driver_name || ''} (${booking.driver_phone || ''}) still hasn't confirmed and pickup is close. Customer ${booking.name} ${booking.phone}. Manual dispatch required NOW. ${adminBookingLink(booking)}`,
 });
 return { action:'escalate_driver_unconfirmed', ok:true };
}

// Sends a customer checkpoint. If the customer hasn't confirmed yet, this is
// a full slide-to-confirm request (a fresh single-use token every time). If
// they already confirmed at an earlier checkpoint, this is a lighter plain
// reminder instead — no need to demand re-confirmation every time.
async function executeCustomerConfirm(booking, stage){
 const column = stage === '48h' ? 'customer_confirm_48h_sent_at' : stage === '24h' ? 'customer_confirm_24h_sent_at' : 'customer_confirm_2h_sent_at';
 const label = stage === '48h' ? '48 hours' : stage === '24h' ? '24 hours' : '2 hours';
 let result;
 if (!booking.customer_confirmed_at) {
  const token = await issueCustomerConfirmToken({
   bookingId: booking.id,
   stage,
   expiresAt: new Date(new Date(booking.pickup_at).getTime() + 2 * 60 * 60 * 1000),
  });
  const body = `MY BLACK LIMO SERVICE — please confirm your ride, pickup in ${label}.\nRef ${booking.reference}\n${formatWhen(booking.pickup_at)}\nPickup: ${booking.origin}\nDrop-off: ${booking.destination}\nVehicle: ${booking.vehicle || 'as booked'}\n\nConfirm now: ${customerConfirmLink(token)}\n\nNeed to change or cancel? Call +61 420 770 707.`;
  result = await sendWhatsAppAndSms(booking.phone, body);
 } else {
  const body = `MY BLACK LIMO SERVICE — reminder: your chauffeur pickup is in ${label}.\nRef ${booking.reference}\n${formatWhen(booking.pickup_at)}\nPickup: ${booking.origin}\nDrop-off: ${booking.destination}\nVehicle: ${booking.vehicle || 'as booked'}\n\nQuestions? Call +61 420 770 707.`;
  result = await sendWhatsAppAndSms(booking.phone, body);
 }
 await updateBooking(booking.id, { [column]: new Date() });
 return { action:`customer_confirm_${stage}`, ok: Boolean(result.whatsapp.sent || result.sms.sent) };
}

// The customer never confirmed at 48h, 24h or 2h — final deadline is 1 hour
// before pickup, giving management a window to call the customer directly
// before the driver is dispatched/en route.
async function executeCustomerEscalate(booking){
 await flagManualDispatch(booking.id, 'customer_unconfirmed_1h_before_pickup');
 await updateBooking(booking.id, { customer_manual_dispatch_at: new Date() });
 await alertManagement({
  subject: `MBLS — URGENT: customer hasn't confirmed ${booking.reference}`,
  smsBody: `MBLS ALERT — CUSTOMER HASN'T CONFIRMED. ${booking.reference} pickup ${formatWhen(booking.pickup_at)}. ${booking.name} ${booking.phone}. Please call the customer directly before the driver departs. ${adminBookingLink(booking)}`,
 });
 return { action:'customer_escalate_unconfirmed', ok:true };
}

export async function sendCustomerBookingConfirmation(booking){
 const body = `MY BLACK LIMO SERVICE — booking confirmed.\nRef ${booking.reference}\n${formatWhen(booking.pickup_at)}\nPickup: ${booking.origin}\nDrop-off: ${booking.destination}\nVehicle: ${booking.vehicle || 'as booked'}\nFare: $${Number(booking.quoted_fare || booking.quotedFare || 0).toFixed(0)} AUD\n\nYour chauffeur will be confirmed shortly and you will receive reminders as your pickup approaches. On time, every time.`;
 const result = await sendWhatsAppAndSms(booking.phone, body);
 await updateBooking(booking.id, { customer_confirmation_sent_at: new Date() });
 return result;
}

// Executes one due action against one booking row. Booking rows passed in
// from the cron sweep come straight from SQL; we join driver name/phone in
// here on demand so the notify layer always has current contact details
// even right after a reassignment.
async function withDriverContact(booking){
 if (!booking.driver_id) return booking;
 const { rows } = await sql`SELECT name, phone FROM drivers WHERE id = ${booking.driver_id}`;
 const d = rows[0];
 return d ? { ...booking, driver_name: d.name, driver_phone: d.phone } : booking;
}

export async function runDispatchForBooking(bookingRow){
 const booking = await withDriverContact(bookingRow);
 const actions = computeDueActions(booking);
 const results = [];
 for (const action of actions) {
  try {
   if (action === 'assign_driver') results.push(await executeAssignDriver(booking));
   else if (action === 'send_driver_24h') results.push(await executeSendDriver24h(booking));
   else if (action === 'send_driver_90m') results.push(await executeSendDriver90m(booking));
   else if (action === 'call_driver_75m') results.push(await executeCallDriver75m(booking));
   else if (action === 'reassign_50m') results.push(await executeReassign50m(booking));
   else if (action === 'escalate_driver_unconfirmed') results.push(await executeEscalateDriverUnconfirmed(booking));
   else if (action === 'customer_confirm_48h') results.push(await executeCustomerConfirm(booking, '48h'));
   else if (action === 'customer_confirm_24h') results.push(await executeCustomerConfirm(booking, '24h'));
   else if (action === 'customer_confirm_2h') results.push(await executeCustomerConfirm(booking, '2h'));
   else if (action === 'customer_escalate_unconfirmed') results.push(await executeCustomerEscalate(booking));
  } catch (e) {
   console.error('DISPATCH_ACTION_FAILED', booking.reference, action, e.message);
   results.push({ action, ok:false, error: e.message });
  }
 }
 return results;
}

export async function assignDriverAtBookingTime(){
 const drivers = await getActiveDrivers();
 if (!drivers.length) return null;
 return pickNextDriver();
}
