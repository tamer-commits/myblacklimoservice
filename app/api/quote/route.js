import { NextResponse } from 'next/server';

const PRICING={
 'S-Class':{minimum:105,perKm:3.35,perMinute:.72},
 'V-Class':{minimum:120,perKm:3.25,perMinute:.70},
 'Audi Q7':{minimum:110,perKm:3.20,perMinute:.69},
 'Sprinter':{minimum:155,perKm:4.10,perMinute:.82}
};
const AIRPORT_RX=/sydney airport|kingsford smith|\bSYD\b/i;
function round5(n){return Math.ceil(n/5)*5}
export async function POST(req){
 try{
  const body=await req.json();
  const {origin,destination,vehicle='V-Class',baby=0,booster=0,meet=false,returnTrip=false,date='',time=''}=body;
  if(!origin||!destination) return NextResponse.json({error:'Pickup and destination are required.'},{status:400});
  const key=process.env.GOOGLE_MAPS_API_KEY;
  if(!key) return NextResponse.json({error:'Live route pricing is awaiting Google Maps activation.'},{status:503});
  const r=await fetch('https://routes.googleapis.com/directions/v2:computeRoutes',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':'routes.distanceMeters,routes.duration'},body:JSON.stringify({origin:{address:origin},destination:{address:destination},travelMode:'DRIVE',routingPreference:'TRAFFIC_AWARE',computeAlternativeRoutes:false,units:'METRIC'})});
  if(!r.ok) return NextResponse.json({error:'We could not calculate that route. Please check the addresses.'},{status:400});
  const data=await r.json(),route=data.routes?.[0]; if(!route) return NextResponse.json({error:'No driving route found.'},{status:404});
  const km=route.distanceMeters/1000,minutes=parseFloat(route.duration||'0')/60,p=PRICING[vehicle]||PRICING['V-Class'];
  const distanceComponent=km*p.perKm, timeComponent=minutes*p.perMinute;
  let oneWay=Math.max(p.minimum,p.minimum+distanceComponent+timeComponent);
  const airport=AIRPORT_RX.test(origin)||AIRPORT_RX.test(destination); if(airport) oneWay+=20;
  oneWay+=Number(baby)*20+Number(booster)*10+(meet&&!airport?20:0);
  const hour=Number((time||'12:00').split(':')[0]); const afterHours=hour<5||hour>=23; if(afterHours) oneWay*=1.15;
  const fare=round5(returnTrip?oneWay*1.9:oneWay);
  return NextResponse.json({km:Number(km.toFixed(1)),minutes:Math.round(minutes),fare,vehicle,currency:'AUD',breakdown:{minimum:p.minimum,distance:Number(distanceComponent.toFixed(2)),time:Number(timeComponent.toFixed(2)),airport,afterHours,returnDiscount:returnTrip?'5%':null},notice:'Indicative fixed quote. Parking, unusual tolls, special-event access and extended waiting may require confirmation.'});
 }catch(e){return NextResponse.json({error:'Unable to calculate route right now.'},{status:500});}
}
