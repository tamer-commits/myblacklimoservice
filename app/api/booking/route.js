import { NextResponse } from 'next/server';
function clean(v,max=500){return String(v??'').trim().slice(0,max)}
async function createSquareCheckout(booking){
 const token=process.env.SQUARE_ACCESS_TOKEN,locationId=process.env.SQUARE_LOCATION_ID;
 if(!token||!locationId) return null;
 const sandbox=(process.env.SQUARE_ENVIRONMENT||'production').toLowerCase()==='sandbox';
 const host=sandbox?'https://connect.squareupsandbox.com':'https://connect.squareup.com';
 const site=(process.env.NEXT_PUBLIC_SITE_URL||'https://www.myblacklimoservice.com').replace(/\/$/,'');
 const r=await fetch(`${host}/v2/online-checkout/payment-links`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Square-Version':'2026-08-19','Content-Type':'application/json'},body:JSON.stringify({idempotency_key:`${booking.reference}-${Date.now()}`,quick_pay:{name:`MBLS ${booking.vehicle} chauffeur booking ${booking.reference}`,price_money:{amount:Math.round(booking.quotedFare*100),currency:'AUD'},location_id:locationId},checkout_options:{redirect_url:`${site}/booking-confirmed?ref=${encodeURIComponent(booking.reference)}`},pre_populated_data:{buyer_email:booking.email,buyer_phone_number:booking.phone},payment_note:`${booking.reference}: ${booking.origin} to ${booking.destination} on ${booking.date} ${booking.time}`})});
 const d=await r.json(); if(!r.ok) throw new Error(d.errors?.[0]?.detail||'Square checkout could not be created.');
 return d.payment_link?.url||d.payment_link?.long_url||null;
}
export async function POST(req){
 try{
  const raw=await req.json();
  const b={name:clean(raw.name,100),email:clean(raw.email,160),phone:clean(raw.phone,40),origin:clean(raw.origin,250),destination:clean(raw.destination,250),date:clean(raw.date,20),time:clean(raw.time,20),vehicle:clean(raw.vehicle,40),passengers:Math.max(1,Math.min(24,Number(raw.passengers)||1)),child:Math.max(0,Number(raw.child)||0),baby:Math.max(0,Number(raw.baby)||0),booster:Math.max(0,Number(raw.booster)||0),meet:Boolean(raw.meet),returnTrip:Boolean(raw.returnTrip),notes:clean(raw.notes,1000),quotedFare:Math.max(0,Number(raw.quotedFare)||0),routeKm:Math.max(0,Number(raw.routeKm)||0),routeMinutes:Math.max(0,Number(raw.routeMinutes)||0)};
  if(!b.name||!b.email||!b.phone||!b.origin||!b.destination||!b.date||!b.time) return NextResponse.json({error:'Please complete your contact, date, time and journey details.'},{status:400});
  if(!/^\S+@\S+\.\S+$/.test(b.email)) return NextResponse.json({error:'Please enter a valid email address.'},{status:400});
  if(!b.quotedFare||!b.routeKm) return NextResponse.json({error:'Please calculate the live route before booking.'},{status:400});
  const reference=`MBL-${Date.now().toString().slice(-8)}`,receivedAt=new Date().toISOString();
  const booking={reference,status:'AWAITING_PAYMENT',...b,receivedAt};
  let paymentUrl=null,paymentError=null;
  try{paymentUrl=await createSquareCheckout(booking)}catch(e){paymentError=e.message;console.error('SQUARE_CHECKOUT_ERROR',reference,e)}
  if(!paymentUrl) booking.status='AWAITING_MANUAL_CONFIRMATION';
  console.log('BOOKING_REQUEST',booking);
  return NextResponse.json({ok:true,reference,status:booking.status,amount:b.quotedFare,currency:'AUD',paymentUrl,paymentReady:Boolean(paymentUrl),paymentError:paymentUrl?null:paymentError,message:paymentUrl?'Booking created. Continue to secure payment to confirm your request.':'Your booking request has been received. We will contact you to confirm it.'});
 }catch(e){console.error(e);return NextResponse.json({error:'Unable to submit booking request.'},{status:500});}
}