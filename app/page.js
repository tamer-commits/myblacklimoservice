import Image from 'next/image';
import heroMaster from '../mbls-homepage-master.png';
import Link from 'next/link';

const services=[['✈️','Airport Transfers','airport-transfers'],['👑','VIP Transfers','vip-events'],['💍','Weddings','weddings'],['🕘','Hourly Charter','as-directed'],['💼','Corporate Travel','corporate-travel'],['📅','Events & Occasions','vip-events'],['🎀','Formal','formal'],['☆','As Directed','as-directed']];

export default function Home(){return <main className="home">
<section className="approvedHero masterHeroOnly"><Image src={heroMaster} alt="My Black Limo Service Sydney luxury chauffeur fleet" fill priority sizes="100vw" className="heroMaster"/></section>
<section className="homeGrid cleanGrid">
<div className="servicesPanel"><h2>OUR SERVICES</h2><div className="serviceGrid">{services.map(([i,t,id])=><Link href={`/services#${id}`} key={t}><span>{i}</span>{t}</Link>)}</div><Link className="outlineButton" href="/services">VIEW ALL SERVICES</Link></div>
<div className="aboutPanel"><h2>ABOUT US</h2><p>My Black Limo Service is Sydney’s premier chauffeur service, offering luxury vehicles and professional chauffeurs dedicated to an exceptional travel experience.</p><ul><li>On time, every time</li><li>Immaculate presentation</li><li>Absolute discretion guaranteed</li></ul><Link className="outlineButton" href="/about">LEARN MORE</Link></div>
<div className="chauffeurPanel"><div className="chauffeurMark">MBLS</div><strong>PROFESSIONAL CHAUFFEURS</strong><small>Presentation. Reliability. Discretion.</small><Link className="outlineButton" href="/fleet">VIEW OUR FLEET</Link></div>
<div className="trackingPanel"><h2>LIVE JOURNEY SHARING</h2><div className="mapVisual"><span>📍</span><strong>Peace of mind while you travel</strong><small>Share journey progress with loved ones when available.</small></div><Link className="outlineButton" href="/quote">GET AN INSTANT QUOTE</Link></div>
</section></main>}