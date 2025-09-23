import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/server/sqlite';

export async function GET(request: NextRequest) {
  try {
    const cookie = request.cookies.get('pinterest_auth');
    if (!cookie) return NextResponse.json({ pins: [] });
    const auth = JSON.parse(cookie.value);
    const userId = String(auth.id || auth.username);
    const db = getDb();
    const rows = db.prepare(`
      SELECT id, board_id as boardId, title, description, link,
             image_url as imageUrl, image_width as imageWidth, image_height as imageHeight,
             created_at as createdAt,
             CASE WHEN is_video = 1 THEN 1 ELSE 0 END as isVideo
      FROM pins
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(userId);
    return NextResponse.json({ pins: rows });
  } catch (e) {
    console.error('[LOCAL ALL PINS] Error:', e);
    return NextResponse.json({ pins: [] });
  }
}

