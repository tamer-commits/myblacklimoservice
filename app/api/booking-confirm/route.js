import { NextResponse } from 'next/server';
import { dbConfigured, consumeCustomerConfirmToken, updateBooking, sql } from '../../../lib/db';

// A customer taps the link in their SMS/WhatsApp, lands on /booking-confirm,
// slides the confirm bar, and the client posts the token here. One token is
// issued per checkpoint (48h / 24h / 2h) and can only ever be used once —
// reused or expired tokens are rejected outright. Consuming ANY checkpoint's
// token sets customer_confirmed_at, which turns every later checkpoint into
// a light reminder instead of another confirmation demand.
export async function POST(req){
 try{
  if(!dbConfigured()) return NextResponse.json({ok:false,error:'Booking system is not fully configured yet.'},{status:503});
  const { token } = await req.json();
  if(!token || typeof token !== 'string') return NextResponse.json({ok:false,error:'Missing confirmation token.'},{status:400});

  const consumed = await consumeCustomerConfirmToken(token);
  if(!consumed.ok){
   const messages = { not_found:'This confirmation link is not valid.', already_used:'This confirmation has already been recorded — thank you.', expired:'This confirmation link has expired. Please call us on +61 420 770 707.' };
   return NextResponse.json({ok:false,error:messages[consumed.reason]||'Unable to confirm.'},{status: consumed.reason==='already_used'?200:400});
  }

  const { row } = consumed;
  const booking = await updateBooking(row.booking_id, { customer_confirmed_at: new Date() });

  return NextResponse.json({ ok:true, stage: row.stage, reference: booking?.reference, pickupAt: booking?.pickup_at });
 }catch(e){
  console.error('CUSTOMER_CONFIRM_FAILED', e.message);
  return NextResponse.json({ok:false,error:'Unable to confirm right now. Please call us on +61 420 770 707.'},{status:500});
 }
}

export async function GET(req){
 // Lightweight lookup so the confirm page can show the customer what they're
 // confirming before they slide — never marks anything as used.
 try{
  if(!dbConfigured()) return NextResponse.json({ok:false,error:'Booking system is not fully configured yet.'},{status:503});
  const token = new URL(req.url).searchParams.get('token');
  if(!token) return NextResponse.json({ok:false,error:'Missing token.'},{status:400});
  const { rows } = await sql`SELECT t.stage, t.used_at, t.expires_at, b.reference, b.origin, b.destination, b.pickup_at, b.vehicle FROM customer_confirm_tokens t JOIN bookings b ON b.id = t.booking_id WHERE t.token = ${token}`;
  const row = rows[0];
  if(!row) return NextResponse.json({ok:false,error:'This confirmation link is not valid.'},{status:404});
  return NextResponse.json({ ok:true, used: Boolean(row.used_at), expired: new Date(row.expires_at) < new Date(), stage: row.stage, reference: row.reference, origin: row.origin, destination: row.destination, pickupAt: row.pickup_at, vehicle: row.vehicle });
 }catch(e){
  console.error('CUSTOMER_CONFIRM_LOOKUP_FAILED', e.message);
  return NextResponse.json({ok:false,error:'Unable to load confirmation details.'},{status:500});
 }
}
