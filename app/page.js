import heroMaster from '../mbls-homepage-master.png';

const topHotspots=[
['home','/','16.5%','1%','5%','5%',false],['services','/services','21.5%','1%','7%','5%',true],['fleet','/fleet','29%','1%','5%','5%',false],['booking','/quote','34%','1%','7%','5%',true],['about','/about','40%','1%','7%','5%',false],['our-fleet','/fleet','47%','1%','7%','5%',false],['women','/women-for-women','54%','1%','11%','5%',false],['contact','/contact','65%','1%','7%','5%',false],['phone','tel:+61420770707','73%','1%','12%','5%',false],['top-book','/quote','85%','1%','12%','5%',true],
['hero-book','/quote','2.7%','37.2%','17.5%','5.2%',true],
['water','/amenities#water','0%','47.0%','12.5%','12.5%',true],['mints','/amenities#mints','12.5%','47.0%','12.5%','12.5%',true],['comfort','/amenities#comfort','25%','47.0%','12.5%','12.5%',true],['charging','/amenities#charging','37.5%','47.0%','12.5%','12.5%',true],['wifi','/amenities#wifi','50%','47.0%','12.5%','12.5%',true],['holders','/amenities#holders','62.5%','47.0%','12.5%','12.5%',true],['sound','/amenities#sound','75%','47.0%','12.5%','12.5%',true],['tracking','/amenities#tracking','87.5%','47.0%','12.5%','12.5%',true]
];

const services=[
['Airport Transfers','/services#airport-transfers'],['VIP Transfers','/services#vip-transfers'],['Weddings','/services#weddings'],['Private Charter','/services#private-charter'],['Corporate Travel','/services#corporate-travel'],['Events & Occasions','/services#events'],['School Formals','/services#formal'],['As Directed','/services#as-directed'],['Women for Women','/services#women-for-women']
];

export default function Home(){return <main className="home masterHomepage">
  <section className="masterTop" aria-label="My Black Limo Service hero and amenities">
    <img src={heroMaster.src} width="1536" height="1024" alt="My Black Limo Service — Sydney luxury chauffeur service" fetchPriority="high" decoding="async" className="masterImage"/>
    {topHotspots.map(([name,href,left,top,width,height,newTab])=><a key={name} href={href} target={newTab?'_blank':undefined} rel={newTab?'noopener noreferrer':undefined} title={name.replaceAll('-',' ')} aria-label={name.replaceAll('-',' ')} className="hotspot" style={{left,top,width,height}} />)}
  </section>

  <section className="homeLower">
    <div className="lowerServices">
      <h2>OUR SERVICES</h2>
      <div className="serviceLinks">{services.map(([label,href])=><a key={label} href={href} target="_blank" rel="noopener noreferrer">{label}</a>)}</div>
      <a className="homeOutline" href="/services" target="_blank" rel="noopener noreferrer">VIEW ALL SERVICES</a>
    </div>

    <div className="lowerAbout">
      <h2>ABOUT US</h2>
      <p>My Black Limo Service is Sydney's premium chauffeur service, offering luxury vehicles and professional chauffeurs dedicated to a polished, discreet and dependable travel experience.</p>
      <ul><li>On time, every time</li><li>Immaculate presentation</li><li>Absolute discretion guaranteed</li></ul>
      <a className="homeOutline" href="/about">LEARN MORE</a>
    </div>

    <div className="lowerChauffeur" aria-label="Professional chauffeur service"><div className="chauffeurShade"><span>PROFESSIONAL CHAUFFEUR SERVICE</span><b>Presentation. Comfort. Discretion.</b></div></div>

    <div className="lowerMap">
      <h2>LIVE MAP TRACKING</h2>
      <div className="mapFrame"><iframe src="https://www.google.com/maps?output=embed&saddr=SYD%20Terminal%201&daddr=Sydney%20NSW" title="Sydney Airport to Sydney route map" loading="lazy" referrerPolicy="no-referrer-when-downgrade"/></div>
      <a className="homeOutline mapQuote" href="/quote" target="_blank" rel="noopener noreferrer">GET AN INSTANT QUOTE</a>
    </div>
  </section>

  <footer className="homeFooter"><div className="footerBrand">MBLS <small>MY BLACK LIMO SERVICE</small></div><a href="tel:+61420770707">+61 420 770 707</a><a href="mailto:info@myblacklimoservice.com">info@myblacklimoservice.com</a><span>Sydney, Australia</span><div className="footerLegal"><a href="/privacy">Privacy Policy</a><a href="/terms">Terms & Conditions</a><a href="/refund">Refund Policy</a></div></footer>
</main>}