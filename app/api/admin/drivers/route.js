import { NextResponse } from 'next/server';
import { dbConfigured, listDrivers, addDriver } from '../../../../lib/db';
import { authorizedByKeyOrSession } from '../../../../lib/admin';

// Driver roster management. Accepts EITHER the original shared
// x-admin-key header (ADMIN_API_KEY — kept for any existing automation)
// OR a logged-in admin session (ADMIN_EMAILS allowlist), so the new /admin
// UI works without breaking anything that already depends on the key.
export async function GET(req){
 if(!(await authorizedByKeyOrSession(req))) return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
 if(!dbConfigured()) return NextResponse.json({ok:false,error:'Database is not configured yet.'},{status:503});
 const drivers = await listDrivers();
 return NextResponse.json({ ok:true, drivers });
}

export async function POST(req){
 if(!(await authorizedByKeyOrSession(req))) return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
 if(!dbConfigured()) return NextResponse.json({ok:false,error:'Database is not configured yet.'},{status:503});
 try{
  const { name, phone } = await req.json();
  const cleanName = String(name||'').trim().slice(0,100);
  const cleanPhone = String(phone||'').trim().slice(0,40);
  if(!cleanName || !cleanPhone) return NextResponse.json({ok:false,error:'name and phone are required.'},{status:400});
  const driver = await addDriver({ name: cleanName, phone: cleanPhone });
  return NextResponse.json({ ok:true, driver });
 }catch(e){
  console.error('ADMIN_ADD_DRIVER_FAILED', e.message);
  return NextResponse.json({ok:false,error:'Unable to add driver.'},{status:500});
 }
}
