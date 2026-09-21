import { NextResponse } from 'next/server';
import { dbConfigured, getBookingWithDriver, updateBooking } from '../../../../../lib/db';
import { getAdminFromRequest } from '../../../../../lib/admin';

export async function GET(req, context){
 const admin = await getAdminFromRequest(req);
 if(!admin) return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
 if(!dbConfigured()) return NextResponse.json({ok:false,error:'Database is not configured yet.'},{status:503});
 const { id } = await context.params;
 const bookingId = Number(id);
 if(!bookingId) return NextResponse.json({ok:false,error:'Invalid id'},{status:400});
 const booking = await getBookingWithDriver(bookingId);
 if(!booking) return NextResponse.json({ok:false,error:'Not found'},{status:404});
 return NextResponse.json({ ok:true, booking });
}

// Manual override: change status and/or reassign the driver. `status` is
// accepted as any non-empty trimmed string rather than a fixed enum —
// the bookings.status column has no DB-level enum constraint and the app
// already writes several different values (AWAITING_PAYMENT,
// AWAITING_MANUAL_CONFIRMATION, AWAITING_CONFIRMATION, CANCELLED, ...), so
// this stays a manual escape hatch rather than a second source of truth for
// what statuses are "valid".
export async function PATCH(req, context){
 const admin = await getAdminFromRequest(req);
 if(!admin) return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
 if(!dbConfigured()) return NextResponse.json({ok:false,error:'Database is not configured yet.'},{status:503});
 const { id } = await context.params;
 const bookingId = Number(id);
 if(!bookingId) return NextResponse.json({ok:false,error:'Invalid id'},{status:400});
 try{
  const body = await req.json();
  const fields = {};
  if(body.status !== undefined){
   const status = String(body.status).trim().slice(0, 60);
   if(!status) return NextResponse.json({ok:false,error:'status cannot be empty.'},{status:400});
   fields.status = status;
  }
  if(body.driverId !== undefined){
   fields.driver_id = body.driverId === null || body.driverId === '' ? null : Number(body.driverId);
  }
  if(!Object.keys(fields).length) return NextResponse.json({ok:false,error:'Nothing to update.'},{status:400});
  const booking = await updateBooking(bookingId, fields);
  if(!booking) return NextResponse.json({ok:false,error:'Not found'},{status:404});
  return NextResponse.json({ ok:true, booking });
 }catch(e){
  console.error('ADMIN_UPDATE_BOOKING_FAILED', e.message);
  return NextResponse.json({ok:false,error:'Unable to update booking.'},{status:500});
 }
}
