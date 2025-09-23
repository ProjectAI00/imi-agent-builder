import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/server/drizzle';
import { sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    const cookie = request.cookies.get('pinterest_auth');
    if (!cookie) return NextResponse.json({ pins: [] });
    const auth = JSON.parse(cookie.value);
    const userId = String(auth.id || auth.username);
    await ensureSchema();
    const db = getDb();
    if (!q) {
      return NextResponse.json({ pins: [] });
    }
    const like = `%${q.replace(/%/g, '')}%`;
    const rows = await db.execute(sql`
      SELECT p.id, p.title, p.description, p.link, p.image_url as "imageUrl", p.image_width as "imageWidth", p.image_height as "imageHeight", p.created_at as "createdAt",
             CASE WHEN p.is_video = 1 THEN 1 ELSE 0 END as "isVideo",
             b.name as "boardName", p.board_id as "boardId"
      FROM pins p
      JOIN boards b ON b.id = p.board_id
      WHERE p.user_id = ${userId} AND (
        p.title LIKE ${like} OR p.description LIKE ${like} OR b.name LIKE ${like} OR p.link LIKE ${like}
      )
      ORDER BY p.created_at DESC
      LIMIT 200
    `);
    const pins = rows.rows ?? rows;
    return NextResponse.json({ pins });
  } catch (e) {
    console.error('[LOCAL SEARCH] Error:', e);
    return NextResponse.json({ pins: [] });
  }
}
