import { NextResponse } from 'next/server';
import { dbConfigured, getUserById, getBookingsByUserId } from '../../../../../lib/db';
import { getAdminFromRequest } from '../../../../../lib/admin';

export async function GET(req, context){
 const admin = await getAdminFromRequest(req);
 if(!admin) return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
 if(!dbConfigured()) return NextResponse.json({ok:false,error:'Database is not configured yet.'},{status:503});
 const { id } = await context.params;
 const userId = Number(id);
 if(!userId) return NextResponse.json({ok:false,error:'Invalid id'},{status:400});
 const user = await getUserById(userId);
 if(!user) return NextResponse.json({ok:false,error:'Not found'},{status:404});
 const bookings = await getBookingsByUserId(userId);
 return NextResponse.json({
  ok:true,
  customer: {
   id: user.id,
   fullName: user.full_name,
   email: user.email,
   emailVerified: Boolean(user.email_verified_at),
   phone: user.phone,
   phoneVerified: Boolean(user.phone_verified_at),
   secondPhone: user.second_phone,
   whatsappNumber: user.whatsapp_number,
   whatsappSameAsMobile: user.whatsapp_same_as_mobile,
   createdAt: user.created_at,
  },
  bookings,
 });
}
