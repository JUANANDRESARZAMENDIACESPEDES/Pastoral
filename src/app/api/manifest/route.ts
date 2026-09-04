import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseRouteConfig } from '@/lib/supabaseRoute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  let version = '1';

  const supabaseConfig = getSupabaseRouteConfig();
  if (supabaseConfig) {
    try {
      const supabase = createClient(supabaseConfig.url, supabaseConfig.key);
      const { data, error } = await supabase
        .from('pjl_store')
        .select('value')
        .eq('key', 'branding')
        .maybeSingle();
      if (!error && data?.value && typeof data.value === 'object') {
        const branding = data.value as { mainLogo?: string };
        const logo = branding.mainLogo || 'default';
        let seed = 0;
        for (let i = 0; i < logo.length; i++) seed = (seed * 31 + logo.charCodeAt(i)) >>> 0;
        version = String(seed);
      }
    } catch {
      version = '1';
    }
  }

  const v = version;
  const manifest = {
    name: 'Pastoral Juvenil Luqueña',
    short_name: 'PJL Luque',
    description: 'Sitio oficial de la Pastoral Juvenil Luqueña. Comunidad, fe, agenda y novedades para la juventud de Luque.',
    lang: 'es',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#1A2744',
    theme_color: '#1A2744',
    categories: ['lifestyle', 'education', 'social'],
    id: '/',
    icons: [
      { src: `/api/pwa-icon?size=192&v=${v}`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `/api/pwa-icon?size=512&v=${v}`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `/api/pwa-icon?size=512&v=${v}`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
