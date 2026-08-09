import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = parseInt(searchParams.get('id') || '0', 10);
  if (id > 0) {
    const result = await db.deleteUser(id);
    return NextResponse.json(result);
  }
  return NextResponse.json({ success: false, error: 'Invalid ID' });
}

export async function POST(request: Request) {
  try {
    let id = 0;
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await request.json();
      id = parseInt(body.id || '0', 10);
    } else {
      const formData = await request.formData();
      id = parseInt((formData.get('id') as string) || '0', 10);
    }

    if (id > 0) {
      const result = await db.deleteUser(id);
      return NextResponse.json(result);
    }
    return NextResponse.json({ success: false, error: 'Invalid ID' });
  } catch (error) {
    console.error('delete_user error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
