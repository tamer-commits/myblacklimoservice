import heroMaster from '../mbls-homepage-master.png';

const hotspots=[
['home','/','16.5%','1%','5%','5%'],['services','/services','21.5%','1%','7%','5%'],['fleet','/fleet','29%','1%','5%','5%'],['booking','/quote','34%','1%','7%','5%'],['about','/about','40%','1%','7%','5%'],['our-fleet','/fleet','47%','1%','7%','5%'],['women','/women-for-women','54%','1%','11%','5%'],['contact','/contact','65%','1%','7%','5%'],['phone','tel:+61420770707','73%','1%','12%','5%'],['top-book','/quote','85%','1%','12%','5%'],
['hero-book','/quote','2.5%','44%','18%','6%'],
['water','/services#airport-transfers','2%','54%','14%','10%'],['mints','/services','17%','54%','10%','10%'],['comfort','/fleet','28%','54%','11%','10%'],['charging','/fleet','40%','54%','10%','10%'],['wifi','/fleet','51%','54%','10%','10%'],['holders','/fleet','62%','54%','10%','10%'],['sound','/fleet','73%','54%','11%','10%'],['sharing','/quote','85%','54%','12%','10%'],
['view-services','/services','4%','86%','15%','5%'],['learn-more','/about','26%','86%','13%','5%'],['instant-quote','/quote','74%','86%','18%','5%'],
['phone-footer','tel:+61420770707','24%','92%','12%','5%'],['email','mailto:info@myblacklimoservice.com','39%','92%','18%','5%']
];

export default function Home(){return <main className="home masterHomepage"><div className="masterCanvas"><img src={heroMaster.src} width="1536" height="1024" alt="My Black Limo Service — Sydney luxury chauffeur service" fetchPriority="high" decoding="async" className="masterImage"/>{hotspots.map(([name,href,left,top,width,height])=><a key={name} href={href} aria-label={name.replaceAll('-',' ')} className="hotspot" style={{left,top,width,height}} />)}</div></main>}