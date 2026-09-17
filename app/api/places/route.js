import { NextResponse } from 'next/server';
export async function POST(req){
 try{
  const {input,sessionToken}=await req.json();
  if(!input||input.length<3) return NextResponse.json({suggestions:[]});
  const key=process.env.GOOGLE_MAPS_API_KEY;
  if(!key) return NextResponse.json({suggestions:[],pending:true});
  const r=await fetch('https://places.googleapis.com/v1/places:autocomplete',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':key},body:JSON.stringify({input,sessionToken,includedRegionCodes:['au'],locationBias:{circle:{center:{latitude:-33.8688,longitude:151.2093},radius:50000}}})});
  if(!r.ok) return NextResponse.json({suggestions:[]});
  const d=await r.json();
  return NextResponse.json({suggestions:(d.suggestions||[]).map(x=>({placeId:x.placePrediction?.placeId,text:x.placePrediction?.text?.text})).filter(x=>x.text)});
 }catch(e){return NextResponse.json({suggestions:[]});}
}
