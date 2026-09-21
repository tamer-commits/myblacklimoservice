import { NextResponse } from 'next/server';
import { dbConfigured, getBookingsByUserId } from '../../../../lib/db';
import { getSessionFromRequest } from '../../../../lib/session';

export async function GET(req){
 const session = getSessionFromRequest(req);
 if(!session || !dbConfigured()) return NextResponse.json({ ok:true, bookings: [] });
 const bookings = await getBookingsByUserId(session.userId);
 return NextResponse.json({ ok:true, bookings });
}
