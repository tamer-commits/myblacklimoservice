'use client';
import { useEffect, useState } from 'react';
import vclassImg from '../../mbls-fleet-vclass.jpg';
import sclassImg from '../../mbls-fleet-sclass.jpg';
import q7Img from '../../mbls-fleet-q7.jpg';
import sprinterImg from '../../mbls-fleet-sprinter.jpg';
import vclassFull from '../../mbls-fleet-vclass-full.jpg';
import sclassFull from '../../mbls-fleet-sclass-full.jpg';
import q7Full from '../../mbls-fleet-q7-full.jpg';
import sprinterFull from '../../mbls-fleet-sprinter-full.jpg';

const fleet=[['Mercedes-Benz V-Class','Luxury people mover','Up to 7 passengers','Executive airport transfers, families and corporate groups',vclassImg,vclassFull],['Mercedes-Benz S-Class','Flagship luxury sedan','Up to 3 passengers','VIP, executive and special occasion travel',sclassImg,sclassFull],['Audi Q7','Luxury SUV','Up to 5 passengers','Premium private transfers with versatile luggage capacity',q7Img,q7Full],['Mercedes-Benz Sprinter','Executive group vehicle','Up to 14 passengers','Corporate groups, events and larger parties',sprinterImg,sprinterFull]];

export default function Fleet(){
  const [openIndex,setOpenIndex]=useState(null);
  useEffect(()=>{
    if(openIndex===null)return;
    const onKey=(e)=>{if(e.key==='Escape')setOpenIndex(null)};
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[openIndex]);
  const active=openIndex===null?null:fleet[openIndex];
  return <main className="innerPage">
    <section className="innerHero">
      <p className="goldKicker">OUR FLEET</p>
      <h1>Arrive beautifully.</h1>
      <p>A carefully selected luxury fleet prepared to the same standard for every journey.</p>
    </section>
    <section className="fleetGrid">
      {fleet.map((v,i)=><article key={v[0]}>
        <img className="fleetVisual" src={v[4].src} width={v[4].width} height={v[4].height} alt={v[0]+' — '+v[1]} onClick={()=>setOpenIndex(i)} role="button" tabIndex={0} aria-label={'View larger photo of '+v[0]} onKeyDown={(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setOpenIndex(i)}}} />
        <p className="goldKicker">{v[1]}</p>
        <h2>{v[0]}</h2>
        <b>{v[2]}</b>
        <p>{v[3]}</p>
        <a href="/quote">REQUEST THIS VEHICLE →</a>
      </article>)}
    </section>
    <section className="pageCta">
      <h2>Not sure which vehicle suits your journey?</h2>
      <p>Tell us your passengers, luggage and itinerary and we will recommend the right vehicle.</p>
      <a className="goldButton" href="/quote">GET A QUOTE →</a>
    </section>
    {active&&<div className="lightboxOverlay" onClick={()=>setOpenIndex(null)}>
      <button className="lightboxClose" onClick={()=>setOpenIndex(null)} aria-label="Close">×</button>
      <img className="lightboxImg" src={active[5].src} width={active[5].width} height={active[5].height} alt={active[0]+' — '+active[1]} onClick={(e)=>e.stopPropagation()} />
    </div>}
  </main>;
}
