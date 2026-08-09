import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    let userId = 0;
    let status = '';

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      userId = parseInt(body.user_id || body.userId || '0', 10);
      status = body.status || '';
    } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      userId = parseInt((formData.get('user_id') as string) || '0', 10);
      status = (formData.get('status') as string) || '';
    } else {
      const text = await request.text();
      const params = new URLSearchParams(text);
      userId = parseInt(params.get('user_id') || '0', 10);
      status = params.get('status') || '';
    }

    if (userId > 0 && status) {
      const result = await db.updateStatus(userId, status);
      return NextResponse.json(result);
    } else {
      return NextResponse.json({ success: false, error: 'Invalid parameters' });
    }
  } catch (error) {
    console.error('update_status error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
