import './globals.css';
import SiteNav from './siteNav';
export const metadata={title:'My Black Limo Service | Sydney Luxury Chauffeur',description:'Luxury chauffeur and private transfer service in Sydney. Airport transfers, corporate travel, events, weddings and private hire.'};
export default function RootLayout({children}){return <html lang="en"><body><SiteNav/>{children}</body></html>}