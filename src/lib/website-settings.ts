import { z } from 'zod';
export const WEBSITE_MEDIA_BUCKET = 'website-media';
export const MAX_HERO_BYTES = 25 * 1024 * 1024;
export const MAX_POSTER_BYTES = 2 * 1024 * 1024;
const nullable = (schema: z.ZodString) => schema.nullable().default(null);
export const websiteSettingsSchema = z.object({
 calendlyUrl: nullable(z.string().regex(/^https:\/\/calendly\.com\/[A-Za-z0-9/_-]+$/)),
 heroVideoPath: nullable(z.string().regex(/^hero\/[a-f0-9-]{36}\.mp4$/)),
 heroPosterPath: nullable(z.string().regex(/^poster\/[a-f0-9-]{36}\.(png|jpg|webp)$/)),
 walkthroughUrl: nullable(z.string().regex(/^https:\/\/(www\.)?(youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}|youtu\.be\/[A-Za-z0-9_-]{11}|loom\.com\/share\/[a-fA-F0-9]{32})$/)),
 standardPrice: nullable(z.string().max(80)), advisoryPrice: nullable(z.string().max(80)),
 consolidationPrice: nullable(z.string().max(80)), whiteLabelPrice: nullable(z.string().max(80)),
}).strict();
export type WebsiteSettings = z.infer<typeof websiteSettingsSchema>;
export const EMPTY_WEBSITE_SETTINGS = websiteSettingsSchema.parse({});
export function walkthroughEmbed(url: string | null): string | null {
 if (!url || !websiteSettingsSchema.shape.walkthroughUrl.safeParse(url).success) return null;
 const parsed = new URL(url);
 if (parsed.hostname.replace(/^www\./,'') === 'loom.com') return `https://www.loom.com/embed/${parsed.pathname.split('/').pop()}`;
 const id = parsed.hostname.replace(/^www\./,'') === 'youtu.be' ? parsed.pathname.slice(1) : parsed.searchParams.get('v');
 return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}
export function validateWebsiteFile(file: {size:number;type:string}, kind:'hero'|'poster') {
 if (kind==='hero' && (file.type!=='video/mp4' || file.size>MAX_HERO_BYTES)) throw new Error('Choose an MP4 up to 25 MB.');
 if (kind==='poster' && (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size>MAX_POSTER_BYTES)) throw new Error('Choose a PNG, JPG or WebP up to 2 MB.');
}
