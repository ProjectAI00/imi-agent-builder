import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureSchema } from '@/server/drizzle';
import { sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const cookie = request.cookies.get('pinterest_auth');
    if (!cookie) return NextResponse.json({ boards: [] });
    const auth = JSON.parse(cookie.value);
    const userId = String(auth.id || auth.username);
    await ensureSchema();
    const db = getDb();
    const rows = await db.execute(sql`SELECT id, name, description, pin_count as "pinCount", created_at as "createdAt", preview_image as "previewImage" FROM boards WHERE user_id = ${userId} ORDER BY name ASC`);
    const boards = rows.rows ?? rows;
    return NextResponse.json({ boards });
  } catch (e) {
    console.error('[LOCAL BOARDS] Error:', e);
    return NextResponse.json({ boards: [] });
  }
}
