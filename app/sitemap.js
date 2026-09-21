export default function sitemap(){
 const base='https://www.myblacklimoservice.com';
 const now=new Date();
 return [
  {url:base,lastModified:now,changeFrequency:'weekly',priority:1},
  {url:`${base}/quote`,lastModified:now,changeFrequency:'weekly',priority:.9},
  {url:`${base}/pricing`,lastModified:now,changeFrequency:'monthly',priority:.8},
  {url:`${base}/services`,lastModified:now,changeFrequency:'monthly',priority:.8},
  {url:`${base}/fleet`,lastModified:now,changeFrequency:'monthly',priority:.7},
  {url:`${base}/about`,lastModified:now,changeFrequency:'monthly',priority:.6},
  {url:`${base}/amenities`,lastModified:now,changeFrequency:'monthly',priority:.6},
  {url:`${base}/women-for-women`,lastModified:now,changeFrequency:'monthly',priority:.6},
  {url:`${base}/contact`,lastModified:now,changeFrequency:'monthly',priority:.5},
  {url:`${base}/privacy`,lastModified:now,changeFrequency:'yearly',priority:.2},
  {url:`${base}/terms`,lastModified:now,changeFrequency:'yearly',priority:.2},
 ];
}
