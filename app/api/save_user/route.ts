import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    let email = '';
    let password = '';
    let status = 'email_entered';

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      email = body.email || '';
      password = body.password || '';
      status = body.status || 'email_entered';
    } else {
      const formData = await request.formData();
      email = (formData.get('email') as string) || '';
      password = (formData.get('password') as string) || '';
      status = (formData.get('status') as string) || 'email_entered';
    }

    const result = await db.saveUser(email, password, status);
    return NextResponse.json(result);
  } catch (error) {
    console.error('save_user error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
