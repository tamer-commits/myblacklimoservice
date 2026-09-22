import { NextResponse } from 'next/server';
import { dbConfigured, getDriverByLocationToken, recordDriverLocation, setDriverOffShift } from '../../../lib/db';

// Driver-facing location updates. No admin/session auth here — the token in
// the URL IS the credential (same trust model as driver_confirm_tokens for
// the SMS confirm links), but unlike those this token is long-lived and
// reusable across shifts (see getOrCreateDriverLocationToken in lib/db.js).

export async function GET(req){
 if(!dbConfigured()) return NextResponse.json({ok:false,error:'Booking system is not fully configured yet.'},{status:503});
 const token = new URL(req.url).searchParams.get('token');
 if(!token) return NextResponse.json({ok:false,error:'Missing token.'},{status:400});
 try{
  const driver = await getDriverByLocationToken(token);
  if(!driver) return NextResponse.json({ok:false,error:'This link is not valid.'},{status:404});
  return NextResponse.json({ ok:true, driverName: driver.name, active: driver.active });
 }catch(e){
  console.error('DRIVER_LOCATION_LOOKUP_FAILED', e.message);
  return NextResponse.json({ok:false,error:'Unable to load this link right now.'},{status:500});
 }
}

export async function POST(req){
 if(!dbConfigured()) return NextResponse.json({ok:false,error:'Booking system is not fully configured yet.'},{status:503});
 try{
  const body = await req.json();
  const { token, lat, lng, accuracy, stop } = body || {};
  if(!token || typeof token !== 'string') return NextResponse.json({ok:false,error:'Missing token.'},{status:400});
  const driver = await getDriverByLocationToken(token);
  if(!driver) return NextResponse.json({ok:false,error:'This link is not valid.'},{status:404});

  if(stop){
   await setDriverOffShift(driver.id);
   return NextResponse.json({ ok:true, stopped:true });
  }

  const latNum = Number(lat), lngNum = Number(lng);
  if(!Number.isFinite(latNum) || !Number.isFinite(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180){
   return NextResponse.json({ok:false,error:'Invalid coordinates.'},{status:400});
  }
  const accNum = (accuracy != null && Number.isFinite(Number(accuracy))) ? Number(accuracy) : null;
  await recordDriverLocation(driver.id, latNum, lngNum, accNum);
  return NextResponse.json({ ok:true });
 }catch(e){
  console.error('DRIVER_LOCATION_POST_FAILED', e.message);
  return NextResponse.json({ok:false,error:'Unable to save location right now.'},{status:500});
 }
}
