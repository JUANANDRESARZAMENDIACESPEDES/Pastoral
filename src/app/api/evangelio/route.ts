import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const FEED_URL = 'https://www.vaticannews.va/content/vaticannews/es/evangelio-de-hoy.rss.xml';
const SITE_URL = 'https://www.vaticannews.va/es/evangelio-de-hoy.html';

type FeedItem = {
  title: string;
  link: string;
  pubDate: string;
  paragraphs: string[];
};

export async function GET() {
  try {
    const res = await fetch(FEED_URL, { next: { revalidate: 1800 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();

    const itemSeg = (xml.match(/<item>([\s\S]*?)<\/item>/) || [])[1] ?? '';
    if (!itemSeg) throw new Error('feed sin items');

    const title = (itemSeg.match(/^\s*<title>(.*?)<\/title>/m)?.[1] ?? '').trim();
    const guid = (itemSeg.match(/^\s*<guid>(.*?)<\/guid>/m)?.[1] ?? '').trim();
    const pubDate = (itemSeg.match(/^\s*<pubDate>(.*?)<\/pubDate>/m)?.[1] ?? '').trim();
    const desc = (itemSeg.match(/^\s*<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/m)?.[1] ?? '')
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');

    const paragraphs = [...desc.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
      .map((m) => m[1].trim())
      .filter(Boolean);

    const item: FeedItem = {
      title,
      link: guid || SITE_URL,
      pubDate,
      paragraphs,
    };

    return NextResponse.json({ ok: true, ...item }, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400' },
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}