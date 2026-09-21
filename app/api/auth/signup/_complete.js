import { NextResponse } from 'next/server';
import { createUser, getUserByEmail, getUserByPhone } from '../../../../lib/db';
import { signSession, sessionCookieHeader, clearPendingSignupCookieHeader } from '../../../../lib/session';

// Shared by signup/verify-email and signup/verify-phone: once BOTH email and
// phone are verified, create the account, start a real login session, and
// clear the pending-signup cookie. Called from whichever of the two routes
// happens to complete the pair.
export async function completeSignupIfReady(pending){
 if(!pending.emailVerified || !pending.phoneVerified) return { completed:false };

 // Guard against a duplicate created by a double-submit / retry between the
 // two verify calls.
 const [byEmail, byPhone] = await Promise.all([getUserByEmail(pending.email), getUserByPhone(pending.phone)]);
 const user = byEmail || byPhone || await createUser({
  fullName: pending.fullName,
  email: pending.email,
  emailVerifiedAt: new Date().toISOString(),
  phone: pending.phone,
  phoneVerifiedAt: new Date().toISOString(),
  whatsappNumber: pending.whatsappNumber || null,
  whatsappSameAsMobile: pending.whatsappSameAsMobile !== false,
  secondPhone: pending.secondPhone || null,
  googleId: pending.googleId || null,
  avatarUrl: pending.avatarUrl || null,
 });

 const sessionToken = signSession({ userId: user.id });
 const res = NextResponse.json({ ok:true, completed:true, user: publicUser(user) });
 res.headers.append('Set-Cookie', clearPendingSignupCookieHeader());
 res.headers.append('Set-Cookie', sessionCookieHeader(sessionToken));
 return { completed:true, response: res };
}

export function publicUser(user){
 return {
  id: user.id,
  fullName: user.full_name,
  email: user.email,
  emailVerified: Boolean(user.email_verified_at),
  phone: user.phone,
  phoneVerified: Boolean(user.phone_verified_at),
  secondPhone: user.second_phone,
  whatsappNumber: user.whatsapp_number,
  whatsappSameAsMobile: user.whatsapp_same_as_mobile,
  avatarUrl: user.avatar_url,
  hasGoogle: Boolean(user.google_id),
 };
}
