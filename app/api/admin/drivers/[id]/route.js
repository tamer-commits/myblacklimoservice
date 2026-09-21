import { NextResponse } from 'next/server';
import { dbConfigured, setDriverActive } from '../../../../../lib/db';
import { authorizedByKeyOrSession } from '../../../../../lib/admin';

// Toggle a driver active/inactive. Same dual auth as the parent route
// (x-admin-key header OR admin session).
export async function PATCH(req, context){
 if(!(await authorizedByKeyOrSession(req))) return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
 if(!dbConfigured()) return NextResponse.json({ok:false,error:'Database is not configured yet.'},{status:503});
 const { id } = await context.params;
 const driverId = Number(id);
 if(!driverId) return NextResponse.json({ok:false,error:'Invalid id'},{status:400});
 try{
  const body = await req.json();
  if(typeof body.active !== 'boolean') return NextResponse.json({ok:false,error:'active (boolean) is required.'},{status:400});
  const driver = await setDriverActive(driverId, body.active);
  if(!driver) return NextResponse.json({ok:false,error:'Not found'},{status:404});
  return NextResponse.json({ ok:true, driver });
 }catch(e){
  console.error('ADMIN_UPDATE_DRIVER_FAILED', e.message);
  return NextResponse.json({ok:false,error:'Unable to update driver.'},{status:500});
 }
}
