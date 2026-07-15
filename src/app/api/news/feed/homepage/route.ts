/**
 * API Route: GET /api/news/feed/homepage
 * Obtener artículos para mostrar en la página principal (pinned + recientes)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase configuration');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '10'), 50);

    // 1. Obtener artículos pinned
    const { data: pinnedData, error: pinnedError } = await supabase
      .from('news_articles')
      .select(
        `
        id, title, subtitle, body, slug, featured_image_url, gallery_urls,
        published, pinned, pin_order, featured_on_homepage, views_count,
        created_at, updated_at, published_at, expires_at,
        category_id,
        news_categories!left (id, name, slug, icon_emoji, color_hex),
        news_events!left (id, start_date, start_time, end_date, location_name, location_lat, location_lng)
        `
      )
      .eq('published', true)
      .eq('archived', false)
      .eq('pinned', true)
      .order('pin_order', { ascending: true })
      .limit(Math.ceil(limit * 0.3)); // 30% del límite son pinned

    // 2. Obtener artículos recientes
    const { data: recentData, error: recentError } = await supabase
      .from('news_articles')
      .select(
        `
        id, title, subtitle, body, slug, featured_image_url, gallery_urls,
        published, pinned, pin_order, featured_on_homepage, views_count,
        created_at, updated_at, published_at, expires_at,
        category_id,
        news_categories!left (id, name, slug, icon_emoji, color_hex),
        news_events!left (id, start_date, start_time, end_date, location_name, location_lat, location_lng)
        `
      )
      .eq('published', true)
      .eq('archived', false)
      .eq('pinned', false)
      .order('published_at', { ascending: false })
      .limit(Math.ceil(limit * 0.7)); // 70% del límite son recientes

    if (pinnedError || recentError) {
      return NextResponse.json(
        { success: false, error: 'Error fetching feed' },
        { status: 400 }
      );
    }

    // Combinar: pinned primero, luego recientes
    const combinedData = [...(pinnedData || []), ...(recentData || [])].slice(0, limit);

    return NextResponse.json({
      success: true,
      data: combinedData,
    });
  } catch (error) {
    console.error('Error fetching homepage feed:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching feed' },
      { status: 500 }
    );
  }
}
