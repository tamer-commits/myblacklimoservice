'use client';
import { useEffect, useState } from 'react';

export default function SiteNav(){
 const [user, setUser] = useState(undefined); // undefined = unknown yet, null = logged out
 useEffect(() => {
  fetch('/api/auth/session').then(r=>r.json()).then(d=>setUser(d.user || null)).catch(()=>setUser(null));
 }, []);
 return <header className="quoteHeader siteNav"><a href="/" className="luxBrand"><span className="crest">MB</span><span><b>MBLS</b><small>MY BLACK LIMO SERVICE</small></span></a><nav><a href="/about">About</a><a href="/services" target="_blank" rel="noopener noreferrer">Services</a><a href="/fleet">Fleet</a><a href="/pricing">Pricing</a><a href="/women-for-women">Women for Women</a><a href="/contact">Contact</a>{user ? <a href="/account">Account</a> : user === null ? <a href="/login">Login</a> : null}</nav><a className="outlineButton" href="/quote" target="_blank" rel="noopener noreferrer">BOOK NOW</a></header>
}
