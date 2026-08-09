import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await db.getLatestCoupon();
    return NextResponse.json(data);
  } catch (error) {
    console.error('get_latest_coupon error:', error);
    return NextResponse.json({ coupon: '22' });
  }
}
