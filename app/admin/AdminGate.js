'use client';
import { useEffect, useState } from 'react';

// Client-side gate shared by every /admin page: checks /api/admin/me on
// mount and bounces non-admins to /login. This is UX only — every admin API
// route re-checks the real session + ADMIN_EMAILS allowlist server-side
// regardless of what this component decides, so it is never the actual
// security boundary.
export default function AdminGate({ children }){
 const [state, setState] = useState('checking'); // checking | ok | denied

 useEffect(() => {
  let cancelled = false;
  fetch('/api/admin/me').then(r=>r.json()).then(d => {
   if(cancelled) return;
   if(d.isAdmin){
    setState('ok');
   }else{
    setState('denied');
    window.location.href = '/login?next=/admin';
   }
  }).catch(() => {
   if(cancelled) return;
   setState('denied');
   window.location.href = '/login?next=/admin';
  });
  return () => { cancelled = true; };
 }, []);

 if(state !== 'ok'){
  return (
   <main className="innerPage">
    <section className="quoteIntro">
     <p className="goldKicker">ADMIN</p>
     <p className="status">Checking access…</p>
    </section>
   </main>
  );
 }

 return children;
}
