import { NextResponse } from 'next/server';
import { dbConfigured, listBookingsAdmin } from '../../../../lib/db';
import { getAdminFromRequest } from '../../../../lib/admin';

export async function GET(req){
 const admin = await getAdminFromRequest(req);
 if(!admin) return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
 if(!dbConfigured()) return NextResponse.json({ok:false,error:'Database is not configured yet.'},{status:503});
 const { searchParams } = new URL(req.url);
 const status = (searchParams.get('status') || '').trim() || undefined;
 const limit = parseInt(searchParams.get('limit') || '200', 10) || 200;
 const bookings = await listBookingsAdmin({ status, limit });
 return NextResponse.json({ ok:true, bookings });
}
