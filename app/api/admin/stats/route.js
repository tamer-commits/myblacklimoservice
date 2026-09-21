import { NextResponse } from 'next/server';
import { dbConfigured, countUsers, countActiveDrivers, countUpcomingBookings, countNeedsManualDispatch } from '../../../../lib/db';
import { getAdminFromRequest } from '../../../../lib/admin';

// Quick counts for the /admin dashboard landing page.
export async function GET(req){
 const admin = await getAdminFromRequest(req);
 if(!admin) return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
 if(!dbConfigured()) return NextResponse.json({ok:false,error:'Database is not configured yet.'},{status:503});
 const [customers, activeDrivers, upcomingBookings, needsManualDispatch] = await Promise.all([
  countUsers(),
  countActiveDrivers(),
  countUpcomingBookings(),
  countNeedsManualDispatch(),
 ]);
 return NextResponse.json({ ok:true, stats: { customers, activeDrivers, upcomingBookings, needsManualDispatch } });
}
