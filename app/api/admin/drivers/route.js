import { NextResponse } from 'next/server';
import { dbConfigured, listDrivers, addDriver } from '../../../../lib/db';

// Bare-bones driver roster management, protected by a single shared admin
// key (ADMIN_API_KEY in Vercel env vars) rather than a login system — enough
// to get real drivers into the round-robin now. A proper dispatcher
// dashboard with auth is a reasonable follow-up once the core flow is
// proven out; this keeps that phase unblocked without over-building today.
function authorized(req){
 const key = process.env.ADMIN_API_KEY;
 if(!key) return false; // fail closed: no key configured means no admin access
 return req.headers.get('x-admin-key') === key;
}

export async function GET(req){
 if(!authorized(req)) return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
 if(!dbConfigured()) return NextResponse.json({ok:false,error:'Database is not configured yet.'},{status:503});
 const drivers = await listDrivers();
 return NextResponse.json({ ok:true, drivers });
}

export async function POST(req){
 if(!authorized(req)) return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
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
