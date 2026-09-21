export default function robots(){
 return {
  rules:{
   userAgent:'*',
   allow:'/',
   disallow:['/admin','/admin/*','/account','/login','/signup','/api/*']
  },
  sitemap:'https://www.myblacklimoservice.com/sitemap.xml'
 };
}
