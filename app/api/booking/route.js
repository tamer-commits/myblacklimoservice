import { NextResponse } from 'next/server';

export async function POST(req){
 try{
  const b=await req.json();
  if(!b.name||!b.email||!b.phone||!b.origin||!b.destination) return NextResponse.json({error:'Please complete your contact and journey details.'},{status:400});
  const reference=`MBL-${Date.now().toString().slice(-8)}`;
  // Database/email delivery will be connected after provider credentials are configured.
  console.log('BOOKING_REQUEST',{reference,...b,receivedAt:new Date().toISOString()});
  return NextResponse.json({ok:true,reference,message:'Your chauffeur request has been received.'});
 }catch(e){return NextResponse.json({error:'Unable to submit booking request.'},{status:500});}
}