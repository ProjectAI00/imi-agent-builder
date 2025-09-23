import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/server/drizzle';
import { sql } from 'drizzle-orm';

export async function GET(request: NextRequest, { params }: { params: { boardId: string } }) {
  try {
    const cookie = request.cookies.get('pinterest_auth');
    if (!cookie) return NextResponse.json({ pins: [] });
    const auth = JSON.parse(cookie.value);
    const userId = String(auth.id || auth.username);
    const boardId = params.boardId;
    await ensureSchema();
    const db = getDb();
    const rows = await db.execute(sql`
      SELECT id, title, description, link, image_url as "imageUrl", image_width as "imageWidth", image_height as "imageHeight", created_at as "createdAt",
             CASE WHEN is_video = 1 THEN 1 ELSE 0 END as "isVideo"
      FROM pins WHERE user_id = ${userId} AND board_id = ${boardId}
      ORDER BY created_at DESC
    `);
    const pins = rows.rows ?? rows;
    return NextResponse.json({ boardId, pins });
  } catch (e) {
    console.error('[LOCAL PINS] Error:', e);
    return NextResponse.json({ boardId: params.boardId, pins: [] });
  }
}
