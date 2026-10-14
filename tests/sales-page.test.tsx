// @vitest-environment happy-dom
import React from 'react';
import {describe,it,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
vi.mock('@tanstack/react-router',()=>({Link:({to,children,...props}:any)=><a href={to} {...props}>{children}</a>}));
vi.mock('../src/hooks/usePlatformBranding',()=>({usePlatformBranding:()=>({logoLight:'/logo.png'})}));
vi.mock('../src/integrations/supabase/client',()=>({supabase:{storage:{from:()=>({getPublicUrl:(path:string)=>({data:{publicUrl:`https://example.supabase.co/storage/v1/object/public/website-media/${path}`}})})}}}));
import {SalesPage} from '../src/components/website/SalesPage';
import {EMPTY_WEBSITE_SETTINGS} from '../src/lib/website-settings';
afterEach(cleanup);
Object.defineProperty(window,'matchMedia',{value:()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()})});
describe('public sales presentation',()=>{
 it('shows public sections and request-access fallback, no empty video or prices',()=>{
  const {container}=render(<SalesPage settings={EMPTY_WEBSITE_SETTINGS}/>);expect(screen.getAllByRole('banner')).toHaveLength(1);expect(screen.getByRole('heading',{level:1}).textContent).toContain('Better client conversations.');expect(screen.getByRole('link',{name:/Sign in/}).getAttribute('href')).toBe('/auth');expect(screen.getAllByRole('button',{name:'Sign up with Xero'})).toHaveLength(2);expect(screen.getAllByRole('link',{name:/Book a demo/})[0]!.getAttribute('href')).toBe('/auth?signup=1');expect(container.querySelector('iframe')).toBeNull();expect(container.querySelector('video')).toBeNull();expect(container.querySelectorAll('details')).toHaveLength(6);for(const name of ['Standard','Advisory','Consolidation','White label'])expect(screen.getByRole('heading',{name})).toBeTruthy();
 });
 it('uses safe booking links, optional price and approved sandboxed walkthrough',()=>{
  const {container}=render(<SalesPage settings={{...EMPTY_WEBSITE_SETTINGS,calendlyUrl:'https://calendly.com/demo',standardPrice:'From example price',walkthroughUrl:'https://youtu.be/abcdefghijk'}}/>);const cta=screen.getAllByRole('link',{name:/Book a demo/})[0]!;expect(cta.getAttribute('target')).toBe('_blank');expect(cta.getAttribute('rel')).toContain('noopener');expect(screen.getByText('From example price')).toBeTruthy();expect(container.querySelector('iframe')?.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/abcdefghijk');expect(container.querySelector('iframe')?.getAttribute('sandbox')).toContain('allow-scripts');
 });
});
