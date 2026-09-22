'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

function DriverLocationInner(){
 const params = useParams();
 const token = params?.token || '';
 const [state, setState] = useState('loading'); // loading | ready | sharing | error
 const [driverName, setDriverName] = useState('');
 const [error, setError] = useState('');
 const [lastSent, setLastSent] = useState(null);
 const watchIdRef = useRef(null);
 const lastPostRef = useRef(0);

 useEffect(() => {
  if(!token){ setState('error'); setError('This link is missing a code.'); return; }
  fetch(`/api/driver-location?token=${encodeURIComponent(token)}`)
   .then(r => r.json())
   .then(d => {
    if(!d.ok){ setState('error'); setError(d.error || 'This link is not valid.'); return; }
    setDriverName(d.driverName || '');
    setState('ready');
   })
   .catch(() => { setState('error'); setError('Unable to reach the booking system.'); });
 }, [token]);

 useEffect(() => () => {
  if(watchIdRef.current != null && typeof navigator !== 'undefined' && navigator.geolocation){
   navigator.geolocation.clearWatch(watchIdRef.current);
  }
 }, []);

 function post(body){
  return fetch('/api/driver-location', {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({ token, ...body }),
  }).catch(() => {});
 }

 function stopWatch(){
  if(watchIdRef.current != null){
   navigator.geolocation.clearWatch(watchIdRef.current);
   watchIdRef.current = null;
  }
 }

 function startSharing(){
  if(typeof navigator === 'undefined' || !('geolocation' in navigator)){
   setError('This browser cannot share location.');
   return;
  }
  setError('');
  setState('sharing');
  watchIdRef.current = navigator.geolocation.watchPosition(
   (pos) => {
    const now = Date.now();
    // Throttle posts to roughly every 15s even if the browser fires the
    // watch callback more often than that.
    if(now - lastPostRef.current < 15000) return;
    lastPostRef.current = now;
    const { latitude, longitude, accuracy } = pos.coords;
    post({ lat: latitude, lng: longitude, accuracy });
    setLastSent(new Date());
   },
   (err) => {
    setError(err && err.message ? err.message : 'Unable to get your location.');
    stopWatch();
    setState('ready');
   },
   { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
  );
 }

 function stopSharing(){
  stopWatch();
  post({ stop: true });
  setState('ready');
 }

 return (
  <main className="innerPage" style={{textAlign:'center'}}>
   <section className="innerHero" style={{paddingBottom:40}}>
    <p className="goldKicker">DRIVER LOCATION</p>
    <h1 style={{fontSize:32}}>MY BLACK LIMO SERVICE</h1>

    {state === 'loading' && <p>Loading…</p>}

    {state === 'error' && (
     <div className="driverConfirmCard">
      <p style={{color:'#e08a8a'}}>{error}</p>
      <p>If you believe this is a mistake, please call dispatch on +61 420 770 707.</p>
     </div>
    )}

    {(state === 'ready' || state === 'sharing') && (
     <div className="driverConfirmCard">
      {driverName && <p style={{fontSize:18}}>Hi {driverName}</p>}
      <p style={{color:'#aaa', maxWidth:340, margin:'0 auto 24px'}}>
       Turn this on while you're on shift so dispatch can see roughly where you are. Turn it off any time — nothing is shared while it's off.
      </p>
      <button
       className={state === 'sharing' ? 'outlineButton' : 'goldButton button'}
       style={{padding:'18px 32px', fontSize:14, minWidth:220}}
       onClick={state === 'sharing' ? stopSharing : startSharing}
      >
       {state === 'sharing' ? 'STOP SHARING' : 'SHARE MY LOCATION'}
      </button>
      {state === 'sharing' && (
       <p style={{marginTop:16, color:'#d9a526', fontSize:13}}>
        Sharing live{lastSent ? ` · last sent ${lastSent.toLocaleTimeString('en-AU',{timeZone:'Australia/Sydney'})}` : '…'}
       </p>
      )}
      {error && <p style={{color:'#e08a8a', marginTop:12}}>{error}</p>}
     </div>
    )}
   </section>
  </main>
 );
}

export default function DriverLocationPage(){
 return (
  <Suspense fallback={<main className="innerPage"><section className="innerHero"><p>Loading…</p></section></main>}>
   <DriverLocationInner />
  </Suspense>
 );
}
