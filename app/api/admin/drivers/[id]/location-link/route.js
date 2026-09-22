import { NextResponse } from 'next/server';
import { dbConfigured, getOrCreateDriverLocationToken } from '../../../../../../lib/db';
import { authorizedByKeyOrSession } from '../../../../../../lib/admin';

// Returns (creating on first call) a driver's persistent location-sharing
// link, so admin can copy it and send it to the driver via SMS/WhatsApp.
// The token never expires and is reused across shifts — the driver opens
// the same link each shift and taps "Share my location".
export async function GET(req, context){
 if(!(await authorizedByKeyOrSession(req))) return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
 if(!dbConfigured()) return NextResponse.json({ok:false,error:'Database is not configured yet.'},{status:503});
 const { id } = await context.params;
 const driverId = Number(id);
 if(!driverId) return NextResponse.json({ok:false,error:'Invalid id'},{status:400});
 try{
  const token = await getOrCreateDriverLocationToken(driverId);
  const base = process.env.NEXT_PUBLIC_SITE_URL || '';
  return NextResponse.json({ ok:true, url: `${base}/driver-location/${token}` });
 }catch(e){
  console.error('ADMIN_DRIVER_LOCATION_LINK_FAILED', e.message);
  return NextResponse.json({ok:false,error:'Unable to create location link.'},{status:500});
 }
}
