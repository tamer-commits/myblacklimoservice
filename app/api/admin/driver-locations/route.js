import { NextResponse } from 'next/server';
import { dbConfigured, getLatestDriverLocations } from '../../../../lib/db';
import { getAdminFromRequest } from '../../../../lib/admin';

// Live GPS positions for on-shift drivers (dispatch map). Drivers who have
// never shared their location simply don't appear — this always returns an
// array, never an error, once past the auth/db-configured checks.
export async function GET(req){
 const admin = await getAdminFromRequest(req);
 if(!admin) return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
 if(!dbConfigured()) return NextResponse.json({ok:false,error:'Database is not configured yet.'},{status:503});
 try{
  const drivers = await getLatestDriverLocations();
  return NextResponse.json({ ok:true, drivers });
 }catch(e){
  console.error('ADMIN_DRIVER_LOCATIONS_FAILED', e.message);
  return NextResponse.json({ok:false,error:'Unable to load driver locations.'},{status:500});
 }
}
