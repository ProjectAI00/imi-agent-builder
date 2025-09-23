import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/server/drizzle';
import { sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const cookie = request.cookies.get('pinterest_auth');
    if (!cookie) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const auth = JSON.parse(cookie.value);
    const accessToken = auth.access_token as string | undefined;
    const userId = String(auth.id || auth.username);
    const username = String(auth.username || '');
    const name = String(auth.name || username);
    if (!accessToken) return NextResponse.json({ error: 'No token' }, { status: 401 });

    await ensureSchema();
    const db = getDb();
    const now = Date.now();
    db.prepare(`INSERT INTO users(id, username, name, updated_at) VALUES(?,?,?,?)
                ON CONFLICT(id) DO UPDATE SET username=excluded.username, name=excluded.name, updated_at=excluded.updated_at`).run(userId, username, name, now);

    // Helper to call Pinterest API with auth
    const call = async (url: URL) => {
      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) throw new Error(`${url.pathname} failed: ${res.status}`);
      return res.json();
    };

    // Fetch ALL boards with pagination (bookmark)
    const boards: any[] = [];
    let boardsBookmark: string | undefined;
    do {
      const url = new URL('https://api.pinterest.com/v5/boards');
      url.searchParams.set('page_size', '100');
      url.searchParams.set('fields', 'id,name,description,pin_count,created_at,cover_pin');
      if (boardsBookmark) url.searchParams.set('bookmark', boardsBookmark);
      const json = await call(url);
      boards.push(...(json.items || []));
      boardsBookmark = json.bookmark;
    } while (boardsBookmark);

    const upsertBoard = async (row: any) => {
      await db.execute(sql`INSERT INTO boards(id, user_id, name, description, pin_count, created_at, preview_image, updated_at)
        VALUES(${row.id}, ${row.user_id}, ${row.name}, ${row.description}, ${row.pin_count}, ${row.created_at}, ${row.preview_image}, ${row.updated_at})
        ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, pin_count=EXCLUDED.pin_count, created_at=EXCLUDED.created_at, preview_image=EXCLUDED.preview_image, updated_at=EXCLUDED.updated_at`);
    };

    const upsertPin = async (row: any) => {
      await db.execute(sql`INSERT INTO pins(id, user_id, board_id, title, description, link, image_url, image_width, image_height, is_video, created_at, updated_at)
        VALUES(${row.id}, ${row.user_id}, ${row.board_id}, ${row.title}, ${row.description}, ${row.link}, ${row.image_url}, ${row.image_width}, ${row.image_height}, ${row.is_video}, ${row.created_at}, ${row.updated_at})
        ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description, link=EXCLUDED.link, image_url=EXCLUDED.image_url, image_width=EXCLUDED.image_width, image_height=EXCLUDED.image_height, is_video=EXCLUDED.is_video, created_at=EXCLUDED.created_at, updated_at=EXCLUDED.updated_at`);
    };

    for (const b of boards) {
      const previewImage = b.cover_pin?.media?.images?.['600x']?.url || b.cover_pin?.media?.images?.original?.url || b.cover_pin?.media?.images?.['564x']?.url || null;
      await upsertBoard({
        id: b.id,
        user_id: userId,
        name: b.name,
        description: b.description || null,
        pin_count: Number(b.pin_count || 0),
        created_at: b.created_at || null,
        preview_image: previewImage,
        updated_at: now,
      });

      // Fetch ALL pins for each board with pagination
      let bookmark: string | undefined;
      let pageCount = 0;
      do {
        const pinsUrl = new URL(`https://api.pinterest.com/v5/boards/${b.id}/pins`);
        pinsUrl.searchParams.set('page_size', '100');
        pinsUrl.searchParams.set('fields', 'id,title,description,link,created_at,media,board');
        if (bookmark) pinsUrl.searchParams.set('bookmark', bookmark);
        const pinsJson = await call(pinsUrl);
        const pins = (pinsJson.items || []) as any[];
        bookmark = pinsJson.bookmark;
        pageCount++;

        for (const p of pins) {
          const imageUrl = p.media?.images?.['600x']?.url || p.media?.images?.['564x']?.url || p.media?.images?.original?.url || null;
          const isVideo = Number(Boolean(
            p.media?.type === 'video' || p.media?.video_list || p.media?.videos || p.media?.video
          ));
        await upsertPin({
          id: p.id,
          user_id: userId,
          board_id: b.id,
          title: p.title || null,
          description: p.description || null,
          link: p.link || null,
          image_url: imageUrl,
          image_width: p.media?.images?.['600x']?.width || p.media?.images?.original?.width || null,
          image_height: p.media?.images?.['600x']?.height || p.media?.images?.original?.height || null,
          is_video: isVideo,
          created_at: p.created_at || null,
          updated_at: now,
        });
        }
        // Safety: avoid runaway loops
        if (pageCount > 50) break;
      } while (bookmark);
    }

    return NextResponse.json({ ok: true, boards: boards.length });
  } catch (e) {
    console.error('[LOCAL REFRESH] Error:', e);
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 });
  }
}
