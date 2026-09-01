// Pure escalation logic + the message copy for the driver/customer
// notification workflow, plus the executor that carries an action out and
// records it on the booking row. Kept separate from the API routes so both
// the booking-creation route (fires the first checkpoint immediately) and
// the cron route (fires every subsequent checkpoint every 5 minutes) share
// one source of truth — a booking can never be double-sent because every
// action is gated on its own *_sent_at / *_confirmed_at column being null.

import { sql, updateBooking, pickNextDriver, issueDriverConfirmToken, getActiveDrivers } from './db';
import { sendWhatsAppAndSms, sendSms, callDriver } from './notify';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.myblacklimoservice.com').replace(/\/$/, '');
const DISPATCH_ALERT_PHONE = process.env.DISPATCH_ALERT_PHONE || '';

function formatWhen(pickupAt){
 try{
  return new Date(pickupAt).toLocaleString('en-AU', { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit', timeZone:'Australia/Sydney' });
 }catch{ return String(pickupAt); }
}

function confirmLink(token){
 return `${SITE}/driver-confirm?token=${token}`;
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

 if (!booking.driver_confirm_24h_sent_at && !booking.driver_confirmed_24h_at && minutesToPickup <= 24 * 60) {
  actions.push('send_driver_24h');
 }

 if (!booking.driver_confirm_90m_sent_at && minutesToPickup <= 90) {
  actions.push('send_driver_90m');
 }

 if (!booking.driver_confirmed_90m_at && booking.driver_confirm_90m_sent_at && !booking.driver_call_75m_sent_at && minutesToPickup <= 75) {
  actions.push('call_driver_75m');
 }

 if (!booking.driver_confirmed_90m_at && !booking.reassigned_60m_at && !booking.needs_manual_dispatch && minutesToPickup <= 60) {
  actions.push('reassign_60m');
 }

 if (!booking.customer_reminder_90m_sent_at && minutesToPickup <= 90) {
  actions.push('customer_reminder_90m');
 }

 if (!booking.customer_reminder_60m_sent_at && minutesToPickup <= 60) {
  actions.push('customer_reminder_60m');
 }

 return actions;
}

async function sendDriverConfirmRequest(booking, stage){
 const driver = { id: booking.driver_id, phone: booking.driver_phone, name: booking.driver_name };
 const token = await issueDriverConfirmToken({
  bookingId: booking.id,
  driverId: booking.driver_id,
  stage,
  expiresAt: new Date(new Date(booking.pickup_at).getTime() + 2 * 60 * 60 * 1000),
 });
 const label = stage === '24h' ? '24 hours' : stage === '90m' ? '90 minutes' : 'shortly';
 const body = `MBLS DISPATCH — ${driver.name}, please confirm you are on for pickup in ${label}.\nRef ${booking.reference}\n${formatWhen(booking.pickup_at)}\nPickup: ${booking.origin}\nDrop-off: ${booking.destination}\nVehicle: ${booking.vehicle || 'as booked'}\n\nConfirm now: ${confirmLink(token)}`;
 return sendWhatsAppAndSms(driver.phone, body);
}

async function executeAssignDriver(booking){
 const driver = await pickNextDriver();
 if (!driver) {
  await updateBooking(booking.id, { needs_manual_dispatch: true });
  if (DISPATCH_ALERT_PHONE) {
   await sendSms(DISPATCH_ALERT_PHONE, `MBLS DISPATCH ALERT — no active driver available for ${booking.reference} (${formatWhen(booking.pickup_at)}). Manual dispatch required.`);
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

async function executeReassign60m(booking){
 const nextDriver = await pickNextDriver({ excludeId: booking.driver_id });
 if (!nextDriver) {
  await updateBooking(booking.id, { reassigned_60m_at: new Date(), needs_manual_dispatch: true });
  if (DISPATCH_ALERT_PHONE) {
   await sendSms(DISPATCH_ALERT_PHONE, `MBLS DISPATCH ALERT — ${booking.driver_name || 'driver'} did not confirm ${booking.reference} (${formatWhen(booking.pickup_at)}) and no other active driver is available. Manual dispatch required now.`);
  }
  return { action:'reassign_60m', ok:false, reason:'no_backup_driver' };
 }
 await updateBooking(booking.id, {
  driver_id: nextDriver.id,
  reassigned_60m_at: new Date(),
  reassignment_count: (booking.reassignment_count || 0) + 1,
  driver_confirm_90m_sent_at: null,
  driver_confirmed_90m_at: null,
  driver_call_75m_sent_at: null,
 });
 const rebooked = { ...booking, driver_id: nextDriver.id, driver_phone: nextDriver.phone, driver_name: nextDriver.name };
 const result = await sendDriverConfirmRequest(rebooked, 'reassign');
 await updateBooking(booking.id, { driver_confirm_90m_sent_at: new Date() });
 if (DISPATCH_ALERT_PHONE) {
  await sendSms(DISPATCH_ALERT_PHONE, `MBLS DISPATCH — ${booking.reference} reassigned from ${booking.driver_name || 'previous driver'} to ${nextDriver.name} (no confirmation by 60min).`);
 }
 return { action:'reassign_60m', ok: Boolean(result.whatsapp.sent || result.sms.sent), driverId: nextDriver.id };
}

async function executeCustomerReminder(booking, minutes){
 const body = `MY BLACK LIMO SERVICE — your chauffeur is confirmed for pickup in approximately ${minutes} minutes.\nRef ${booking.reference}\nPickup: ${booking.origin}\nDrop-off: ${booking.destination}\nVehicle: ${booking.vehicle || 'as booked'}\n\nQuestions? Reply to this message or call +61 420 770 707.`;
 const result = await sendWhatsAppAndSms(booking.phone, body);
 const column = minutes === 90 ? 'customer_reminder_90m_sent_at' : 'customer_reminder_60m_sent_at';
 await updateBooking(booking.id, { [column]: new Date() });
 return { action:`customer_reminder_${minutes}m`, ok: Boolean(result.whatsapp.sent || result.sms.sent) };
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
   else if (action === 'reassign_60m') results.push(await executeReassign60m(booking));
   else if (action === 'customer_reminder_90m') results.push(await executeCustomerReminder(booking, 90));
   else if (action === 'customer_reminder_60m') results.push(await executeCustomerReminder(booking, 60));
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
