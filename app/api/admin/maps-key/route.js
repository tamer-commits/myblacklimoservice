import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '../../../../lib/admin';

// Hands the browser the Google Maps JavaScript API key so the admin map
// page (app/admin/map/page.js) can load Google's map script client-side,
// without adding a separate NEXT_PUBLIC_ env var — this reuses the same
// GOOGLE_MAPS_API_KEY already used server-side for quote/places.
//
// This route is admin-gated, but note that once the Maps script tag loads
// in the browser the key is visible in that request regardless — same as
// it would be with a NEXT_PUBLIC_ var. That's normal for Google Maps JS
// keys: they're meant to be restricted by HTTP referrer + API, not kept
// secret. For this to actually work, the key must have "Maps JavaScript
// API" allowed under API restrictions and this site's domain allowed as an
// HTTP referrer in Google Cloud Console — see Credentials > this key.
export async function GET(req){
 const admin = await getAdminFromRequest(req);
 if(!admin) return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
 const key = process.env.GOOGLE_MAPS_API_KEY;
 if(!key) return NextResponse.json({ok:false,error:'Google Maps is not configured yet.'},{status:503});
 return NextResponse.json({ ok:true, key });
}
