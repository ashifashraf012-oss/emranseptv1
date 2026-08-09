import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    let coupon = '';
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      coupon = body.coupon || '';
    } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      coupon = (formData.get('coupon') as string) || '';
    } else {
      const text = await request.text();
      const params = new URLSearchParams(text);
      coupon = params.get('coupon') || '';
    }

    if (coupon.trim()) {
      const result = await db.saveCoupon(coupon.trim());
      return NextResponse.json(result);
    } else {
      return NextResponse.json({ success: false, error: 'Empty coupon' });
    }
  } catch (error) {
    console.error('save_coupon error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
