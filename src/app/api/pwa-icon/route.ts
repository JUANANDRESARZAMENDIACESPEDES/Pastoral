import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import { getSupabaseRouteConfig } from '@/lib/supabaseRoute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_LOGO = '/pjl-logo.svg';

async function loadLogoBuffer(url: string): Promise<Buffer | null> {
  try {
    if (url.startsWith('data:')) {
      const comma = url.indexOf(',');
      if (comma < 0) return null;
      const b64 = url.slice(comma + 1).replace(/\s/g, '');
      return Buffer.from(b64, 'base64');
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const res = await fetch(url);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    }
    if (url.startsWith('/')) {
      // Ruta relativa => archivo estático dentro de /public. No podemos usar
      // fetch con URL relativa en el servidor (sin host), así que lo leemos
      // del disco. Se normaliza y se impide el escapado fuera de /public.
      const safePath = normalize(url).replace(/^(\.\.[/\\])+/, '');
      const filePath = join(process.cwd(), 'public', safePath);
      if (!filePath.startsWith(join(process.cwd(), 'public'))) return null;
      return await readFile(filePath);
    }
    return null;
  } catch {
    return null;
  }
}

function circleBuffer(size: number): Buffer {
  const radius = size / 2;
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - radius + 0.5;
      const dy = y - radius + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const alpha = dist <= radius ? 255 : 0;
      const idx = (y * size + x) * 4;
      buf[idx] = 0;
      buf[idx + 1] = 0;
      buf[idx + 2] = 0;
      buf[idx + 3] = alpha;
    }
  }
  return buf;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sizeParam = parseInt(searchParams.get('size') || '192', 10);
  const size = sizeParam === 512 ? 512 : 192;

  let mainLogo: string | null = null;

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
        if (branding.mainLogo) mainLogo = branding.mainLogo;
      }
    } catch {
      mainLogo = null;
    }
  }

  if (mainLogo && (mainLogo === '/pjl-logo.svg' || mainLogo.length < 100)) {
    mainLogo = DEFAULT_LOGO;
  }
  if (!mainLogo) mainLogo = DEFAULT_LOGO;

  const buf = await loadLogoBuffer(mainLogo);
  if (!buf) {
    return new NextResponse('Logo no disponible', { status: 404 });
  }

  try {
    const metadata = await sharp(buf).metadata();
    if (!metadata.width || !metadata.height) {
      return new NextResponse('Imagen inválida', { status: 400 });
    }

    const circle = circleBuffer(size);
    const circlePng = await sharp(circle, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();

    const composited = await sharp(buf)
      .resize(size, size, { fit: 'cover' })
      .ensureAlpha()
      .png()
      .toBuffer()
      .then((pngBuffer) =>
        sharp(pngBuffer)
          .composite([{ input: circlePng, blend: 'dest-in' }])
          .png()
          .toBuffer()
      );

    return new NextResponse(new Uint8Array(composited), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch {
    return new NextResponse('Error generando icono', { status: 500 });
  }
}
