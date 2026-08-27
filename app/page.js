import Link from 'next/link';

const amenities = [
  ['💧','STILL & SPARKLING WATER','Complimentary'],
  ['🌿','FRESH MINTS','Always available'],
  ['💺','PREMIUM COMFORT','Spacious & refined'],
  ['🔋','CHARGING PORTS','Stay powered'],
  ['📶','UNLIMITED WI-FI','Stay connected'],
  ['📱','PHONE HOLDERS','For your convenience'],
  ['🔊','PREMIUM SURROUND SOUND','Exceptional audio'],
  ['📍','LIVE JOURNEY SHARING','Peace of mind'],
];
const services = [
  ['✈️','Airport Transfers'],['👑','VIP Transfers'],['💍','Weddings'],['🕘','Hourly Charter'],
  ['💼','Corporate Travel'],['📅','Events & Occasions'],['🎀','Formal'],['☆','As Directed']
];

export default function Home(){
 return <main className="home">
   <section className="approvedHero" aria-label="My Black Limo Service luxury chauffeur service">
     <img src="/mbls-homepage-master.png" alt="Sydney luxury chauffeur fleet with Audi Q7, Mercedes S-Class and Mercedes V-Class" className="heroMaster" />
     <div className="heroShade" />
     <div className="heroCopy">
       <div className="eyebrow">SYDNEY’S MOST TRUSTED</div>
       <h1>LUXURY<br/>CHAUFFEUR<br/>SERVICE</h1>
       <div className="goldLine" />
       <h2>Sophistication. Discretion. Excellence.</h2>
       <p>Premium chauffeur travel with meticulous presentation, exceptional comfort and reliability you can depend on.</p>
       <Link className="goldButton" href="/quote">BOOK YOUR RIDE →</Link>
       <div className="trust"><span>✓ Professional Drivers</span><span>✓ Punctual</span><span>✓ Discreet</span></div>
     </div>
   </section>

   <section className="amenityBar">
    {amenities.map(([icon,title,sub])=><div className="amenity" key={title}><div className="amenityIcon">{icon}</div><strong>{title}</strong><small>{sub}</small></div>)}
   </section>

   <section className="homeGrid">
    <div className="servicesPanel">
      <h2>OUR SERVICES</h2><div className="serviceGrid">{services.map(([icon,title])=><Link href="/services" key={title}><span>{icon}</span>{title}</Link>)}</div>
      <Link className="outlineButton" href="/services">VIEW ALL SERVICES</Link>
    </div>
    <div className="aboutPanel"><h2>ABOUT US</h2><p>My Black Limo Service is Sydney’s premier chauffeur service, offering luxury vehicles and professional chauffeurs dedicated to an exceptional travel experience.</p><ul><li>On time, every time</li><li>Immaculate presentation</li><li>Absolute discretion guaranteed</li></ul><Link className="outlineButton" href="/about">LEARN MORE</Link></div>
    <div className="experiencePhoto" aria-label="Professional chauffeur assisting passenger" />
    <div className="trackingPanel"><h2>LIVE MAP TRACKING</h2><div className="mapVisual"><span>📍</span><strong>Live journey sharing</strong><small>Share your journey with loved ones when available</small></div><Link className="outlineButton" href="/quote">GET AN INSTANT QUOTE</Link></div>
   </section>
 </main>
}
