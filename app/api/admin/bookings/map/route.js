import { NextResponse } from 'next/server';
import { dbConfigured, getBookingsForMap, saveBookingGeocode } from '../../../../../lib/db';
import { getAdminFromRequest } from '../../../../../lib/admin';

// Static pickup/drop-off pins for the admin dispatch map, geocoded from each
// booking's free-text origin/destination address and cached on the booking
// row (origin_lat/lng, dest_lat/lng — see lib/db.js) so the same address is
// never re-geocoded twice. This plots where bookings' addresses are — it is
// NOT live tracking of a customer's phone. Window: bookings from 1 day ago
// to 7 days out (see getBookingsForMap), not the entire historical table.
async function geocode(address, key){
 if(!address) return null;
 try{
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=au&key=${key}`;
  const r = await fetch(url);
  if(!r.ok) return null;
  const d = await r.json();
  const loc = d.results?.[0]?.geometry?.location;
  if(!loc) return null;
  return { lat: loc.lat, lng: loc.lng };
 }catch{
  return null;
 }
}

export async function GET(req){
 const admin = await getAdminFromRequest(req);
 if(!admin) return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
 if(!dbConfigured()) return NextResponse.json({ok:false,error:'Database is not configured yet.'},{status:503});
 const key = process.env.GOOGLE_MAPS_API_KEY;
 try{
  const rows = await getBookingsForMap();
  const results = await Promise.all(rows.map(async (b) => {
   let originLatLng = (b.origin_lat != null && b.origin_lng != null) ? { lat: Number(b.origin_lat), lng: Number(b.origin_lng) } : null;
   let destLatLng = (b.dest_lat != null && b.dest_lng != null) ? { lat: Number(b.dest_lat), lng: Number(b.dest_lng) } : null;

   if((!originLatLng || !destLatLng) && key){
    const [o, d] = await Promise.all([
     originLatLng ? null : geocode(b.origin, key),
     destLatLng ? null : geocode(b.destination, key),
    ]);
    if(o) originLatLng = o;
    if(d) destLatLng = d;
    if(o || d){
     await saveBookingGeocode(b.id, {
      originLat: o ? o.lat : null, originLng: o ? o.lng : null,
      destLat: d ? d.lat : null, destLng: d ? d.lng : null,
     });
    }
   }

   return {
    bookingId: b.id,
    reference: b.reference,
    name: b.name,
    status: b.status,
    pickupAt: b.pickup_at,
    origin: b.origin,
    destination: b.destination,
    originLatLng,
    destinationLatLng: destLatLng,
   };
  }));
  return NextResponse.json({ ok:true, bookings: results });
 }catch(e){
  console.error('ADMIN_BOOKINGS_MAP_FAILED', e.message);
  return NextResponse.json({ok:false,error:'Unable to load bookings for the map.'},{status:500});
 }
}
