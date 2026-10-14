import { createFileRoute } from '@tanstack/react-router';
import { getRouterInstance } from '@tanstack/react-start';
import { sitemapStaticPaths, sitemapXML } from '@/lib/sitemap';
export const Route=createFileRoute('/sitemap.xml')({staticData:{sitemap:false},server:{handlers:{GET:async()=>{
 const router=await getRouterInstance();const entries=sitemapStaticPaths(router).map(path=>({path}));
 if(!entries.length)return new Response('No pages are included in this sitemap',{status:404});
 return new Response(sitemapXML('https://tractionadvisory.com.au',entries),{headers:{'Content-Type':'application/xml','Cache-Control':'public, max-age=3600'}});
}}}});
