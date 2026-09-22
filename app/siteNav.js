'use client';
import { useEffect, useState } from 'react';

export default function SiteNav(){
 const [user, setUser] = useState(undefined); // undefined = unknown yet, null = logged out
 const [isAdmin, setIsAdmin] = useState(false); // only ever true for a signed-in ADMIN_EMAILS account
 useEffect(() => {
  fetch('/api/auth/session').then(r=>r.json()).then(d=>setUser(d.user || null)).catch(()=>setUser(null));
 }, []);
 useEffect(() => {
  if(!user) return; // skip the extra request for guests/logged-out visitors
  fetch('/api/admin/me').then(r=>r.json()).then(d=>setIsAdmin(Boolean(d.isAdmin))).catch(()=>{});
 }, [user]);
 return <header className="quoteHeader siteNav"><a href="/" className="luxBrand"><span className="crest">MB</span><span><b>MBLS</b><small>MY BLACK LIMO SERVICE</small></span></a><nav><a href="/">Home</a><a href="/about">About</a><a href="/services" target="_blank" rel="noopener noreferrer">Services</a><a href="/fleet">Fleet</a><a href="/pricing">Pricing</a><a href="/women-for-women">Women for Women</a><a href="/contact">Contact</a>{isAdmin && <a href="/admin">Admin</a>}{user ? <a href="/account">Account</a> : user === null ? <a href="/login">Login</a> : null}</nav><a className="outlineButton" href="/quote" target="_blank" rel="noopener noreferrer">BOOK NOW</a></header>
}
