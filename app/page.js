import amenitiesStrip from '../mbls-amenities-strip.png';
import { HERO_IMAGE } from './heroData';
const amenityHotspots=[
  ['water','/amenities#water','0%','16.86%',false],
  ['mints','/amenities#mints','16.86%','10.48%',false],
  ['comfort','/amenities#comfort','27.34%','12.5%',false],
  ['charging','/amenities#charging','39.84%','11.01%',false],
  ['wifi','/amenities#wifi','50.85%','11.26%',false],
  ['holders','/amenities#holders','62.11%','11.65%',false],
  ['sound','/amenities#sound','73.76%','12.37%',false],
  ['tracking','/amenities#tracking','86.13%','13.87%',false]
];
const services=[ ['Airport Transfers','/services#airport-transfers'],['VIP Transfers','/services#vip-transfers'],['Weddings','/services#weddings'],['Private Charter','/services#private-charter'],['Corporate Travel','/services#corporate-travel'],['Events & Occasions','/services#events'],['School Formals','/services#formal'],['As Directed','/services#as-directed'],['Women for Women','/services#women-for-women'] ];
export default function Home(){return <main className="home masterHomepage">
  <div className="masterTop">
    <img className="masterImage" src={HERO_IMAGE} alt="My Black Limo Service fleet — Mercedes-Benz and Audi vehicles on Sydney Harbour" width={1536} height={512} loading="eager" />
  </div>
  <section className="heroFleet" aria-label="My Black Limo Service">
    <div className="heroFleetText">
      <p className="goldKicker">SYDNEY'S MOST TRUSTED</p>
      <h1>MY BLACK LIMO SERVICE</h1>
      <p className="heroFleetSub">Sophistication. Discretion. Excellence.</p>
      <p className="heroFleetCopy">Premium chauffeur travel with meticulous presentation, exceptional comfort and reliability you can depend on.</p>
      <a className="goldButton" href="/quote">BOOK YOUR RIDE →</a>
      <div className="heroFleetChecks"><span>✓ Professional Drivers</span><span>✓ Punctual</span><span>✓ Discreet</span></div>
    </div>
  </section>
  <section className="amenitiesStrip" aria-label="Complimentary amenities">
    <img src={amenitiesStrip.src} width={amenitiesStrip.width} height={amenitiesStrip.height} alt="Complimentary amenities — water, mints, comfort, charging, wifi, phone holders, sound, live tracking" className="amenitiesStripImage"/>
    {amenityHotspots.map(([name,href,left,width])=><a key={name} href={href} title={name.replaceAll('-',' ')} aria-label={name.replaceAll('-',' ')} className="hotspot" style={{left,top:'0%',width,height:'100%'}} />)}
  </section>
  <section className="homeLower">
    <div className="lowerServices">
      <h2>OUR SERVICES</h2>
      <p className="lowerServicesSub">Every journey, tailored to you.</p>
      <div className="serviceLinks">{services.map(([label,href])=><a key={label} href={href} target="_blank" rel="noopener noreferrer">{label}</a>)}</div>
      <a className="homeOutline" href="/services" target="_blank" rel="noopener noreferrer">VIEW ALL SERVICES</a>
    </div>
    <div className="lowerAbout">
      <h2>ABOUT US</h2>
      <p>My Black Limo Service is Sydney's premium chauffeur service, offering luxury vehicles and professional chauffeurs dedicated to a polished, discreet and dependable travel experience.</p>
      <ul><li>On time, every time</li><li>Immaculate presentation</li><li>Absolute discretion guaranteed</li></ul>
      <a className="homeOutline" href="/about">LEARN MORE</a>
    </div>
    <div className="lowerMap">
      <h2>LIVE MAP TRACKING</h2>
      <div className="mapFrame"><iframe src="https://www.google.com/maps?output=embed&saddr=SYD%20Terminal%201&daddr=Sydney%20NSW" title="Sydney Airport to Sydney route map" loading="lazy" referrerPolicy="no-referrer-when-downgrade"/></div>
      <a className="homeOutline mapQuote" href="/quote" target="_blank" rel="noopener noreferrer">GET AN INSTANT QUOTE</a>
    </div>
  </section>
  <footer className="homeFooter"><div className="footerBrand">MBLS <small>MY BLACK LIMO SERVICE</small></div><a href="tel:+61420770707">+61 420 770 707</a><a href="mailto:info@myblacklimoservice.com">info@myblacklimoservice.com</a><span>Sydney, Australia</span><div className="footerLegal"><a href="/privacy">Privacy Policy</a><a href="/terms">Terms & Conditions</a><a href="/refund">Refund Policy</a></div></footer>
</main>}
