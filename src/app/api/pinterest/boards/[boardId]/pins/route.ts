import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '25');
    const { boardId } = await params;

    // Get Pinterest auth from cookie
    const cookieStore = request.cookies;
    const authCookie = cookieStore.get('pinterest_auth');
    
    if (!authCookie) {
      return NextResponse.json({ error: 'Not authenticated with Pinterest' }, { status: 401 });
    }

    const pinterestAuth = JSON.parse(authCookie.value);
    const accessToken = pinterestAuth.access_token;

    if (!accessToken) {
      return NextResponse.json({ error: 'No Pinterest access token found' }, { status: 401 });
    }

    // Call real Pinterest API
    console.log(`[BOARD PINS] Getting pins from Pinterest board ${boardId} for user ${pinterestAuth.username}`);
    
    const url = new URL(`https://api.pinterest.com/v5/boards/${boardId}/pins`);
    url.searchParams.append('page_size', Math.min(limit, 100).toString());
    url.searchParams.append('fields', 'id,title,description,link,created_at,media,board');
    
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[BOARD PINS] Pinterest API error: ${response.status}`);
      throw new Error(`Pinterest API error: ${response.status}`);
    }

    const data = await response.json();
    
    const pins = (data.items || []).map((pin: any) => {
      const imageUrl = pin.media?.images?.['600x']?.url || 
                      pin.media?.images?.['564x']?.url || 
                      pin.media?.images?.original?.url ||
                      null;
      const media = pin.media || {};
      const isVideo = Boolean(
        media.type === 'video' ||
        media.video_list ||
        media.videos ||
        media.video ||
        (media.images && media.images['orig'] && media.images['orig'].url && /\.mp4|\.mov|\.webm/i.test(media.images['orig'].url))
      );
      
      console.log(`[BOARD PINS] Pin ${pin.id}:`, {
        hasMedia: !!pin.media,
        hasImages: !!pin.media?.images,
        imageKeys: pin.media?.images ? Object.keys(pin.media.images) : [],
        imageUrl: imageUrl ? imageUrl.substring(0, 50) + '...' : 'null',
        title: pin.title || 'No title'
      });

      return {
        id: pin.id,
        title: pin.title,
        description: pin.description,
        imageUrl: imageUrl || '',
        imageWidth: pin.media?.images?.['600x']?.width || pin.media?.images?.original?.width || 0,
        imageHeight: pin.media?.images?.['600x']?.height || pin.media?.images?.original?.height || 0,
        link: pin.link,
        boardName: pin.board?.name,
        createdAt: pin.created_at,
        isVideo,
      };
    });

    console.log(`[BOARD PINS] Found ${pins.length} real Pinterest pins, ${pins.filter(p => p.imageUrl).length} with valid image URLs`);

    return NextResponse.json({
      boardId,
      pins: pins.slice(0, Math.min(limit, 100)),
    });
  } catch (error) {
    console.error('[BOARD PINS] Pinterest board pins API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch board pins' },
      { status: 500 }
    );
  }
}
