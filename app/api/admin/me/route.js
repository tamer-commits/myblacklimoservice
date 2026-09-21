import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '../../../../lib/admin';

// Lets the admin frontend ask "am I allowed in here?" without ever exposing
// ADMIN_EMAILS or the session payload. Always 200 — the boolean is the
// answer, not an HTTP status, so a logged-out visitor gets a clean
// { isAdmin:false } instead of a 401/500.
export async function GET(req){
 const admin = await getAdminFromRequest(req);
 return NextResponse.json({ ok:true, isAdmin: Boolean(admin), email: admin ? admin.email : null });
}
