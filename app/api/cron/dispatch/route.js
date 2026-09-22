import { NextResponse } from 'next/server';
import { dbConfigured, getUpcomingBookings } from '../../../../lib/db';
import { runDispatchForBooking } from '../../../../lib/dispatch';

// Hit on a schedule by .github/workflows/dispatch-cron.yml (every 5 minutes)
// rather than Vercel Cron, because Vercel's Hobby plan only allows a cron job
// to run once per day — nowhere near enough for 48h/24h/90m/75m/50m/2h/1h
// checkpoints. The workflow sends `Authorization: Bearer <CRON_SECRET>`,
// which is what we check below; until CRON_SECRET is set this route is
// intentionally left open so dispatch can be tested manually during setup.
export const maxDuration = 60;

function authorized(req){
 const secret = process.env.CRON_SECRET;
 if(!secret) return true;
 return req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(req){
 if(!authorized(req)) return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
 if(!dbConfigured()) return NextResponse.json({ok:true,skipped:true,reason:'db_not_configured'});

 try{
  const bookings = await getUpcomingBookings();
  const summary = [];
  // Every booking is processed independently, wrapped in its own try/catch:
  // this is a safety-critical reminder run for potentially dozens of real
  // trips in one pass, so one bad/unexpected row (e.g. a malformed pickup
  // time, a transient DB hiccup mid-loop) must never stop reminders from
  // going out for every OTHER booking in the same sweep. runDispatchForBooking
  // already isolates failures per ACTION; this isolates per BOOKING as well.
  for(const booking of bookings){
   try{
    const results = await runDispatchForBooking(booking);
    if(results.length) summary.push({ reference: booking.reference, results: results.map(r=>({action:r.action, ok:r.ok})) });
   }catch(e){
    console.error('CRON_DISPATCH_BOOKING_FAILED', booking?.reference, e.message);
    summary.push({ reference: booking?.reference, error: e.message });
   }
  }
  return NextResponse.json({ ok:true, checked: bookings.length, actioned: summary.length, summary });
 }catch(e){
  console.error('CRON_DISPATCH_FAILED', e.message);
  return NextResponse.json({ok:false,error:e.message},{status:500});
 }
}
