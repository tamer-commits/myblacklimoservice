'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function formatWhen(iso){
 if(!iso) return '';
 try{ return new Date(iso).toLocaleString('en-AU',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Australia/Sydney'}); }
 catch{ return iso; }
}

function BookingConfirmInner(){
 const params = useSearchParams();
 const token = params.get('token') || '';
 const [state, setState] = useState('loading'); // loading | ready | confirming | done | error
 const [details, setDetails] = useState(null);
 const [error, setError] = useState('');
 const [slide, setSlide] = useState(0);

 useEffect(() => {
  if(!token){ setState('error'); setError('This link is missing a confirmation code.'); return; }
  fetch(`/api/booking-confirm?token=${encodeURIComponent(token)}`)
   .then(r => r.json())
   .then(d => {
    if(!d.ok){ setState('error'); setError(d.error || 'Unable to load this confirmation.'); return; }
    if(d.used){ setState('done'); return; }
    if(d.expired){ setState('error'); setError('This confirmation link has expired. Please call us on +61 420 770 707.'); return; }
    setDetails(d); setState('ready');
   })
   .catch(() => { setState('error'); setError('Unable to reach the booking system.'); });
 }, [token]);

 async function confirm(){
  if(state !== 'ready') return;
  setState('confirming');
  try{
   const r = await fetch('/api/booking-confirm', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ token }) });
   const d = await r.json();
   if(!d.ok){ setState('error'); setError(d.error || 'Unable to confirm.'); return; }
   setState('done');
  }catch{
   setState('error'); setError('Unable to reach the booking system.');
  }
 }

 function onSlide(e){
  const value = Number(e.target.value);
  setSlide(value);
  if(value >= 96) confirm();
 }

 return (
  <main className="innerPage driverConfirmPage">
   <section className="innerHero" style={{paddingBottom:40}}>
    <p className="goldKicker">RIDE CONFIRMATION</p>
    <h1 style={{fontSize:40}}>MY BLACK LIMO SERVICE</h1>

    {state === 'loading' && <p>Loading your booking details…</p>}

    {state === 'error' && (
     <div className="driverConfirmCard">
      <p style={{color:'#e08a8a'}}>{error}</p>
      <p>Need help, or want to change/cancel this ride? Call us on +61 420 770 707.</p>
     </div>
    )}

    {state === 'done' && (
     <div className="driverConfirmCard driverConfirmDoneCard">
      <p className="driverConfirmCheck">✓</p>
      <p style={{fontSize:20,color:'#d9a526'}}>Confirmed. Thank you.</p>
      <p>We look forward to driving you. You'll receive further reminders as your pickup approaches.</p>
     </div>
    )}

    {(state === 'ready' || state === 'confirming') && details && (
     <div className="driverConfirmCard">
      <p className="driverConfirmRef">Ref {details.reference}</p>
      <p className="driverConfirmWhen">{formatWhen(details.pickupAt)}</p>
      <div className="driverConfirmRoute">
       <div><span className="goldKicker">PICKUP</span><p>{details.origin}</p></div>
       <div><span className="goldKicker">DROP-OFF</span><p>{details.destination}</p></div>
      </div>
      {details.vehicle && <p className="driverConfirmVehicle">Vehicle: {details.vehicle}</p>}

      <label className="slideConfirmLabel" htmlFor="slideConfirm">
       {state === 'confirming' ? 'Confirming…' : 'Slide to confirm you still need this ride'}
      </label>
      <div className="slideConfirmTrack">
       <div className="slideConfirmFill" style={{width:`${slide}%`}} />
       <input
        id="slideConfirm"
        type="range"
        min="0"
        max="100"
        value={slide}
        disabled={state === 'confirming'}
        onChange={onSlide}
        onMouseUp={() => { if(slide < 96) setSlide(0); }}
        onTouchEnd={() => { if(slide < 96) setSlide(0); }}
        className="slideConfirmInput"
        aria-label="Slide to confirm"
       />
      </div>
      <p style={{marginTop:16, fontSize:12, color:'#888'}}>Need to change or cancel? Call us on +61 420 770 707 instead of ignoring this message.</p>
     </div>
    )}
   </section>
  </main>
 );
}

export default function BookingConfirmPage(){
 return (
  <Suspense fallback={<main className="innerPage"><section className="innerHero"><p>Loading…</p></section></main>}>
   <BookingConfirmInner />
  </Suspense>
 );
}
