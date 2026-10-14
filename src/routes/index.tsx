import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SalesPage } from '@/components/website/SalesPage';
import { getPublicWebsiteSettings } from '@/lib/website-settings.functions';
const title='Traction Advisory — Xero dashboards and monthly reports for practices and their clients';
const description='Better client conversations, backed by their numbers. Xero dashboards, monthly reports and clear insights for bookkeepers, accountants, advisers and business owners.';
export const Route=createFileRoute('/')({
 staticData:{sitemap:true},
 loader:()=>getPublicWebsiteSettings(),
 head:()=>({meta:[{title},{name:'description',content:description},{property:'og:title',content:title},{property:'og:description',content:description},{property:'og:type',content:'website'},{property:'og:url',content:'https://tractionadvisory.com.au/'},{name:'twitter:card',content:'summary_large_image'}],links:[{rel:'canonical',href:'https://tractionadvisory.com.au/'}]}),
 component:HomePage,
});
function HomePage(){
 const settings=Route.useLoaderData();const navigate=useNavigate();
 // Presentation-only session routing; the existing protected landing route
 // owns MFA and calls landingFor with caller-scoped workspace signals.
 useEffect(()=>{let active=true;supabase.auth.getSession().then(({data})=>{if(active&&data.session)navigate({to:'/dashboard',replace:true});});return()=>{active=false;};},[navigate]);
 return <SalesPage settings={settings}/>;
}
