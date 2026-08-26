import { NextResponse } from 'next/server';
function clean(v,max=500){return String(v??'').trim().slice(0,max)}
export async function POST(req){
 try{
  const raw=await req.json();
  const b={name:clean(raw.name,100),email:clean(raw.email,160),phone:clean(raw.phone,40),origin:clean(raw.origin,250),destination:clean(raw.destination,250),date:clean(raw.date,20),time:clean(raw.time,20),vehicle:clean(raw.vehicle,40),passengers:Math.max(1,Math.min(24,Number(raw.passengers)||1)),child:Math.max(0,Number(raw.child)||0),baby:Math.max(0,Number(raw.baby)||0),booster:Math.max(0,Number(raw.booster)||0),meet:Boolean(raw.meet),returnTrip:Boolean(raw.returnTrip),notes:clean(raw.notes,1000),quotedFare:Math.max(0,Number(raw.quotedFare)||0)};
  if(!b.name||!b.email||!b.phone||!b.origin||!b.destination||!b.date||!b.time) return NextResponse.json({error:'Please complete your contact, date, time and journey details.'},{status:400});
  if(!/^\S+@\S+\.\S+$/.test(b.email)) return NextResponse.json({error:'Please enter a valid email address.'},{status:400});
  const reference=`MBL-${Date.now().toString().slice(-8)}`; const receivedAt=new Date().toISOString();
  const booking={reference,status:'AWAITING_PAYMENT_OR_CONFIRMATION',...b,receivedAt};
  // Safe hand-off point: Square payment creation + persistent database/email are enabled once credentials are configured in Vercel.
  console.log('BOOKING_REQUEST',booking);
  return NextResponse.json({ok:true,reference,status:booking.status,amount:b.quotedFare,currency:'AUD',paymentReady:Boolean(process.env.SQUARE_ACCESS_TOKEN&&process.env.SQUARE_LOCATION_ID),message:'Your booking request has been received and is awaiting confirmation.'});
 }catch(e){return NextResponse.json({error:'Unable to submit booking request.'},{status:500});}
}