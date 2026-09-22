'use client';
import { useEffect, useRef, useState } from 'react';
import AdminGate from '../AdminGate';

const SYDNEY = { lat: -33.8688, lng: 151.2093 };

const DARK_MAP_STYLE = [
 { elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
 { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a1a' }] },
 { elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
 { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a2a' }] },
 { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1a1a1a' }] },
 { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a3a3a' }] },
 { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1b26' }] },
 { featureType: 'poi', stylers: [{ visibility: 'off' }] },
 { featureType: 'transit', stylers: [{ visibility: 'off' }] },
 { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#3a3a3a' }] },
];

function loadGoogleMaps(key){
 if(typeof window === 'undefined') return Promise.reject(new Error('No window.'));
 if(window.google && window.google.maps) return Promise.resolve();
 if(window.__mblsGmapsLoading) return window.__mblsGmapsLoading;
 window.__mblsGmapsLoading = new Promise((resolve, reject) => {
  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}`;
  script.async = true;
  script.onload = () => resolve();
  script.onerror = () => reject(new Error('Failed to load Google Maps. The API key may need "Maps JavaScript API" enabled for this domain.'));
  document.head.appendChild(script);
 });
 return window.__mblsGmapsLoading;
}

function minutesAgo(iso){
 if(!iso) return null;
 const diffMs = Date.now() - new Date(iso).getTime();
 return Math.max(0, Math.round(diffMs / 60000));
}

function MapInner(){
 const mapDivRef = useRef(null);
 const mapRef = useRef(null);
 const driverMarkersRef = useRef({});
 const bookingMarkersRef = useRef([]);
 const infoWindowRef = useRef(null);
 const [status, setStatus] = useState('loading'); // loading | ready | error
 const [error, setError] = useState('');

 useEffect(() => {
  let cancelled = false;
  (async () => {
   try{
    const r = await fetch('/api/admin/maps-key');
    const d = await r.json();
    if(!d.ok) throw new Error(d.error || 'Google Maps is not configured.');
    await loadGoogleMaps(d.key);
    if(cancelled) return;
    mapRef.current = new window.google.maps.Map(mapDivRef.current, {
     center: SYDNEY,
     zoom: 11,
     styles: DARK_MAP_STYLE,
     streetViewControl: false,
     mapTypeControl: false,
    });
    infoWindowRef.current = new window.google.maps.InfoWindow();
    setStatus('ready');
   }catch(e){
    if(cancelled) return;
    setStatus('error');
    setError(e.message || 'Unable to load the map.');
   }
  })();
  return () => { cancelled = true; };
 }, []);

 function refreshDrivers(){
  fetch('/api/admin/driver-locations').then(r=>r.json()).then(d => {
   if(!d.ok || !mapRef.current || !window.google) return;
   const seen = new Set();
   (d.drivers || []).forEach(row => {
    seen.add(row.driver_id);
    const ago = minutesAgo(row.updated_at);
    const stale = row.on_shift === false || (ago != null && ago > 15);
    const pos = { lat: Number(row.lat), lng: Number(row.lng) };
    let marker = driverMarkersRef.current[row.driver_id];
    if(!marker){
     marker = new window.google.maps.Marker({ map: mapRef.current });
     marker.addListener('click', () => {
      infoWindowRef.current.setContent(marker.__info || '');
      infoWindowRef.current.open(mapRef.current, marker);
     });
     driverMarkersRef.current[row.driver_id] = marker;
    }
    marker.setPosition(pos);
    marker.setIcon({
     path: window.google.maps.SymbolPath.CIRCLE,
     scale: 8,
     fillColor: stale ? '#666666' : '#d9a526',
     fillOpacity: 1,
     strokeColor: '#0e0e0e',
     strokeWeight: 2,
    });
    marker.__info = `<div style="color:#111;font-family:sans-serif;min-width:170px"><strong>${row.name}</strong><br/>${stale ? 'Not currently sharing' : 'On shift, sharing'}<br/>Last updated ${ago != null ? ago + 'm ago' : '—'}</div>`;
   });
   Object.keys(driverMarkersRef.current).forEach(id => {
    if(!seen.has(Number(id))){
     driverMarkersRef.current[id].setMap(null);
     delete driverMarkersRef.current[id];
    }
   });
  }).catch(() => {});
 }

 function refreshBookings(){
  fetch('/api/admin/bookings/map').then(r=>r.json()).then(d => {
   if(!d.ok || !mapRef.current || !window.google) return;
   bookingMarkersRef.current.forEach(m => m.setMap(null));
   bookingMarkersRef.current = [];
   (d.bookings || []).forEach(b => {
    if(b.originLatLng){
     const m = new window.google.maps.Marker({
      map: mapRef.current,
      position: b.originLatLng,
      icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: '#4caf7d', fillOpacity: 1, strokeColor: '#0e0e0e', strokeWeight: 1.5 },
     });
     m.addListener('click', () => {
      infoWindowRef.current.setContent(`<div style="color:#111;font-family:sans-serif;min-width:180px"><strong>${b.reference}</strong><br/>${b.name}<br/>PICKUP · ${b.status}<br/>${b.origin}</div>`);
      infoWindowRef.current.open(mapRef.current, m);
     });
     bookingMarkersRef.current.push(m);
    }
    if(b.destinationLatLng){
     const m = new window.google.maps.Marker({
      map: mapRef.current,
      position: b.destinationLatLng,
      icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: '#c0524a', fillOpacity: 1, strokeColor: '#0e0e0e', strokeWeight: 1.5 },
     });
     m.addListener('click', () => {
      infoWindowRef.current.setContent(`<div style="color:#111;font-family:sans-serif;min-width:180px"><strong>${b.reference}</strong><br/>${b.name}<br/>DROP-OFF · ${b.status}<br/>${b.destination}</div>`);
      infoWindowRef.current.open(mapRef.current, m);
     });
     bookingMarkersRef.current.push(m);
    }
   });
  }).catch(() => {});
 }

 useEffect(() => {
  if(status !== 'ready') return;
  refreshDrivers();
  refreshBookings();
  const t1 = setInterval(refreshDrivers, 30000);
  const t2 = setInterval(refreshBookings, 30000);
  return () => { clearInterval(t1); clearInterval(t2); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [status]);

 return (
  <main className="innerPage">
   <section className="quoteIntro">
    <p className="goldKicker"><a href="/admin" style={{color:'#999'}}>← ADMIN</a></p>
    <h1>Live Map</h1>
    <p>Gold dots are drivers currently on shift and sharing (grey = off or stale &gt;15m). Green pins are pickups, red pins are drop-offs for bookings in the next 7 days. Updates every 30s.</p>
   </section>
   <section className="quoteWorkspace" style={{gridTemplateColumns:'1fr', maxWidth:1200}}>
    <div className="quotePanel" style={{padding:0, overflow:'hidden'}}>
     {status === 'error' && <p className="status" style={{padding:20}}>{error}</p>}
     <div ref={mapDivRef} style={{width:'100%', height:'70vh', minHeight:420, background:'#111'}} />
    </div>
   </section>
  </main>
 );
}

export default function AdminMapPage(){
 return <AdminGate><MapInner/></AdminGate>;
}
