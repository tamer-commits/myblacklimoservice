import { NextResponse } from 'next/server';

const PRICING={
 'S-Class':{minimum:105,perKm:3.35,perMinute:.72},
 'V-Class':{minimum:95,perKm:3.05,perMinute:.65},
 'Audi Q7':{minimum:100,perKm:3.2,perMinute:.69},
 'Sprinter':{minimum:145,perKm:4.1,perMinute:.82}
};

export async function POST(req){
 try{
  const body=await req.json();
  const {origin,destination,vehicle='V-Class',child=0,baby=0,booster=0,meet=false,returnTrip=false}=body;
  if(!origin||!destination) return NextResponse.json({error:'Pickup and destination are required.'},{status:400});
  const key=process.env.GOOGLE_MAPS_API_KEY;
  if(!key) return NextResponse.json({error:'Live route pricing is awaiting Google Maps activation.'},{status:503});
  const r=await fetch('https://routes.googleapis.com/directions/v2:computeRoutes',{
   method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':'routes.distanceMeters,routes.duration,routes.travelAdvisory.tollInfo'},
   body:JSON.stringify({origin:{address:origin},destination:{address:destination},travelMode:'DRIVE',routingPreference:'TRAFFIC_AWARE',computeAlternativeRoutes:false,units:'METRIC'})
  });
  if(!r.ok) return NextResponse.json({error:'We could not calculate that route. Please check the addresses.'},{status:400});
  const data=await r.json(),route=data.routes?.[0];
  if(!route) return NextResponse.json({error:'No driving route found.'},{status:404});
  const km=route.distanceMeters/1000,minutes=parseFloat(route.duration||'0')/60,p=PRICING[vehicle]||PRICING['V-Class'];
  let fare=Math.max(p.minimum,p.minimum+km*p.perKm+minutes*p.perMinute)+Number(child)*15+Number(baby)*20+Number(booster)*10+(meet?20:0);
  if(returnTrip) fare*=1.9;
  return NextResponse.json({km:Number(km.toFixed(1)),minutes:Math.round(minutes),fare:Math.round(fare),vehicle,currency:'AUD'});
 }catch(e){return NextResponse.json({error:'Unable to calculate route right now.'},{status:500});}
}