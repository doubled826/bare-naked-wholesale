import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const isAllowedImageSource = (url: URL) => {
  const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const configuredHost = configuredSupabaseUrl ? new URL(configuredSupabaseUrl).hostname : '';
  const isConfiguredSupabaseHost = configuredHost && url.hostname === configuredHost;
  const isSupabaseHost = url.hostname.endsWith('.supabase.co');

  return (
    (isConfiguredSupabaseHost || isSupabaseHost) &&
    url.pathname.startsWith('/storage/v1/object/public/resources/images/')
  );
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('src') || '';

    if (!source) {
      return NextResponse.json({ error: 'Missing image source.' }, { status: 400 });
    }

    const imageUrl = new URL(source);
    if (!['https:', 'http:'].includes(imageUrl.protocol) || !isAllowedImageSource(imageUrl)) {
      return NextResponse.json({ error: 'Image source is not allowed.' }, { status: 400 });
    }

    const response = await fetch(imageUrl.toString(), {
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Unable to load image.' }, { status: response.status });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'Source is not an image.' }, { status: 400 });
    }

    return new Response(await response.arrayBuffer(), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Email image proxy error:', error);
    return NextResponse.json({ error: 'Unable to load image.' }, { status: 400 });
  }
}
