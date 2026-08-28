import heroMaster from '../mbls-homepage-master.png';
import amenitiesPremium from '../mbls-amenities-premium.png';

const hotspots=[
['home','/','16.5%','1%','5%','5%'],['services','/services','21.5%','1%','7%','5%'],['fleet','/fleet','29%','1%','5%','5%'],['booking','/quote','34%','1%','7%','5%'],['about','/about','40%','1%','7%','5%'],['our-fleet','/fleet','47%','1%','7%','5%'],['women','/women-for-women','54%','1%','11%','5%'],['contact','/contact','65%','1%','7%','5%'],['phone','tel:+61420770707','73%','1%','12%','5%'],['top-book','/quote','85%','1%','12%','5%'],
['hero-book','/quote','2.5%','44%','18%','6%'],
['view-services','/services','4%','86%','15%','5%'],['learn-more','/about','26%','86%','13%','5%'],['instant-quote','/quote','74%','86%','18%','5%'],
['phone-footer','tel:+61420770707','24%','92%','12%','5%'],['email','mailto:info@myblacklimoservice.com','39%','92%','18%','5%']
];

const amenityHotspots=[
['water','/services#airport-transfers','0%','12.5%'],['mints','/services','12.5%','12.5%'],['comfort','/fleet','25%','12.5%'],['charging','/fleet','37.5%','12.5%'],['wifi','/fleet','50%','12.5%'],['holders','/fleet','62.5%','12.5%'],['sound','/fleet','75%','12.5%'],['sharing','/quote','87.5%','12.5%']
];

export default function Home(){return <main className="home masterHomepage"><div className="masterCanvas"><img src={heroMaster.src} width="1536" height="1024" alt="My Black Limo Service — Sydney luxury chauffeur service" fetchPriority="high" decoding="async" className="masterImage"/><div className="premiumAmenities" aria-label="Premium chauffeur amenities"><img src={amenitiesPremium.src} alt="Premium chauffeur amenities including water, mints, comfort, charging, Wi-Fi, phone holders, surround sound and live journey sharing" className="amenitiesImage"/>{amenityHotspots.map(([name,href,left,width])=><a key={name} href={href} aria-label={name.replaceAll('-',' ')} className="amenityHotspot" style={{left,width}} />)}</div>{hotspots.map(([name,href,left,top,width,height])=><a key={name} href={href} aria-label={name.replaceAll('-',' ')} className="hotspot" style={{left,top,width,height}} />)}</div></main>}