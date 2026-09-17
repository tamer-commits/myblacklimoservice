import './globals.css';
import SiteNav from './siteNav';
import { Analytics } from '@vercel/analytics/next';
export const metadata={title:'My Black Limo Service | Sydney Luxury Chauffeur',description:'Luxury chauffeur and private transfer service in Sydney. Airport transfers, corporate travel, events, weddings and private hire.'};
export default function RootLayout({children}){return <html lang="en"><body><SiteNav/>{children}<Analytics /></body></html>}
