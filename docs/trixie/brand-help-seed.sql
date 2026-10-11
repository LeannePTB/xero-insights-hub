-- Insert-only owner-requested knowledge seed: no schema, grants or access changes.
-- Audience is singular in the existing table, so identical content is added for
-- staff and platform separately; viewers do not receive this administration article.
WITH content AS (
 SELECT 'Traction Advisory brand and style guide'::text AS title,
 $article$Official website: www.tractionadvisory.com.au.

1. Use these official web colours: Navy #082E5E; Royal blue #28468E; Mid blue #426CB2; Blue #1E90D1; Light blue #4EB4EB; Black #080909; wordmark grey #939598. Royal is primary; Navy is for strong/active states and light-theme headings; Mid blue is for links/focus; Blue is accent; Light blue is highlight. Charts run light to dark: #4EB4EB, #1E90D1, #426CB2, #28468E, #082E5E. Green remains good, red bad and soft blue informational. Never use orange, amber or gold.
2. Use Colour logo on light backgrounds; White on dark/navy or mid/dark blue; approved Blue artwork is entirely #1E90D1; Blue dark is entirely #082E5E; Black and Grey/black versions are for monochrome use/print. Use the original T and A in a circle for favicon, app icon and collapsed sidebar. Never recolour, stretch, add shadows/effects or place the Colour logo on mid/dark blue. Use approved artwork, not typed replacement letters.
3. Logo fonts only: TRACTION ADVISORY is Gotham Book with -50 letter spacing; T is Beyond (Regular); A is Blacksword (Regular). Beyond and Blacksword must not be used for UI text. The UI keeps its configured SF Pro Display headings and Inter body.
4. UI scale: page titles at most 18px; section headings 16/14px; body 12px; helper 11px; KPI figures at most 24px.
5. The printed HEX/RGB column includes obsolete #53318D, #6f60aa, #c5ab71 and #939497. The designer needs to correct the sheet's printed CMYK/HEX/RGB values. Use the official web values above, not those printed conversions.
6. For accessibility, wordmark grey stays in artwork but small light-theme muted text uses #62666C; dark muted text uses #AEB6C1. Dark small-text links use Light blue because Mid blue is too dark. Accent Blue uses near-black text, not white or navy. These are accessible UI companions, not permission to recolour logos.
Full reference: docs/design/brand-guide.md. Organisation White label and report-logo precedence are unchanged.$article$::text AS body
), inserted AS (
 INSERT INTO public.trixie_knowledge(id,title,body,tags,audience,active)
 SELECT v.id,c.title,c.body,ARRAY['brand','style','logo','colours'],v.audience,true
 FROM content c CROSS JOIN (VALUES
 ('395bd34d-0514-4516-8ac2-339aec58ef20'::uuid,'staff'),
 ('7589ad0e-f069-4e14-a865-e473449c8ee8'::uuid,'platform')
 ) v(id,audience)
 ON CONFLICT(id) DO NOTHING RETURNING id,audience,active
)
INSERT INTO public.audit_log(actor_user_id,action,target_type,target_id,meta)
SELECT NULL,'trixie_starter_article_seeded','trixie_knowledge',id::text,
 jsonb_build_object('audience',audience,'active',active,'source','owner_requested_brand_seed','actor_context','system_data_seed')
FROM inserted;