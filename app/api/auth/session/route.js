import { NextResponse } from 'next/server';
import { getUserById, dbConfigured } from '../../../../lib/db';
import { getSessionFromRequest } from '../../../../lib/session';
import { publicUser } from '../signup/_complete';

// Lets client-side pages ask "am I logged in?" without exposing the signed
// cookie's contents directly.
export async function GET(req){
 const session = getSessionFromRequest(req);
 if(!session || !dbConfigured()) return NextResponse.json({ ok:true, user:null });
 const user = await getUserById(session.userId);
 return NextResponse.json({ ok:true, user: user ? publicUser(user) : null });
}
