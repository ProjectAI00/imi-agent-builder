import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '25');

    // Get Pinterest auth from cookie
    const cookieStore = await cookies();
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
    console.log(`[BOARDS] Getting real Pinterest boards for user ${pinterestAuth.username}`);
    
    const url = new URL('https://api.pinterest.com/v5/boards');
    url.searchParams.append('page_size', Math.min(limit, 100).toString());
    url.searchParams.append('fields', 'id,name,description,pin_count,created_at,cover_pin');
    
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Pinterest API error: ${response.status}`);
    }

    const data = await response.json();
    
    const boards = (data.items || []).map((board: any) => {
      const previewImage = board.cover_pin?.media?.images?.['600x']?.url || 
                          board.cover_pin?.media?.images?.original?.url ||
                          board.cover_pin?.media?.images?.['564x']?.url ||
                          null;
      
      console.log(`[BOARDS] Board ${board.name}:`, {
        hasCoverPin: !!board.cover_pin,
        hasMedia: !!board.cover_pin?.media,
        hasImages: !!board.cover_pin?.media?.images,
        imageKeys: board.cover_pin?.media?.images ? Object.keys(board.cover_pin.media.images) : [],
        previewImage: previewImage ? previewImage.substring(0, 50) + '...' : 'null'
      });

      return {
        id: board.id,
        name: board.name,
        description: board.description,
        pinCount: board.pin_count || 0,
        createdAt: board.created_at,
        previewImage,
      };
    });

    console.log(`[BOARDS] Found ${boards.length} real Pinterest boards, ${boards.filter(b => b.previewImage).length} with preview images`);

    return NextResponse.json({
      boards: boards.slice(0, Math.min(limit, 100)),
    });
  } catch (error) {
    console.error('Pinterest boards API error:', error);
    
    return NextResponse.json({
      boards: [],
    });
  }
}