export default function sitemap(){
 const base='https://myblacklimoservice.com';
 return [
  {url:base,lastModified:new Date(),changeFrequency:'weekly',priority:1},
  {url:`${base}/privacy`,lastModified:new Date(),changeFrequency:'yearly',priority:.2},
  {url:`${base}/terms`,lastModified:new Date(),changeFrequency:'yearly',priority:.2},
 ];
}
