import { NextResponse } from 'next/server';
import { dbConfigured, listUsersAdmin } from '../../../../lib/db';
import { getAdminFromRequest } from '../../../../lib/admin';

export async function GET(req){
 const admin = await getAdminFromRequest(req);
 if(!admin) return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
 if(!dbConfigured()) return NextResponse.json({ok:false,error:'Database is not configured yet.'},{status:503});
 const { searchParams } = new URL(req.url);
 const q = (searchParams.get('q') || '').trim().slice(0, 120);
 const limit = parseInt(searchParams.get('limit') || '200', 10) || 200;
 const offset = parseInt(searchParams.get('offset') || '0', 10) || 0;
 const rows = await listUsersAdmin({ q: q || undefined, limit, offset });
 const customers = rows.map(u => ({
  id: u.id,
  fullName: u.full_name,
  email: u.email,
  emailVerified: Boolean(u.email_verified_at),
  phone: u.phone,
  phoneVerified: Boolean(u.phone_verified_at),
  secondPhone: u.second_phone,
  whatsappNumber: u.whatsapp_number,
  createdAt: u.created_at,
  bookingCount: u.booking_count,
 }));
 return NextResponse.json({ ok:true, customers });
}
