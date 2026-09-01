import { NextResponse } from 'next/server';
import { dbConfigured, getUpcomingBookings } from '../../../../lib/db';
import { runDispatchForBooking } from '../../../../lib/dispatch';

// Vercel Cron hits this on a schedule (see vercel.json — every 5 minutes).
// Vercel automatically sends `Authorization: Bearer $CRON_SECRET` on cron
// invocations once CRON_SECRET is set as an env var, which is what we check
// below; until that var is added this route is intentionally left open so
// dispatch can be tested manually during setup.
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
  for(const booking of bookings){
   const results = await runDispatchForBooking(booking);
   if(results.length) summary.push({ reference: booking.reference, results: results.map(r=>({action:r.action, ok:r.ok})) });
  }
  return NextResponse.json({ ok:true, checked: bookings.length, actioned: summary.length, summary });
 }catch(e){
  console.error('CRON_DISPATCH_FAILED', e.message);
  return NextResponse.json({ok:false,error:e.message},{status:500});
 }
}
