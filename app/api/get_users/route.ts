import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const users = await db.getUsers();
    return NextResponse.json(users);
  } catch (error) {
    console.error('get_users error:', error);
    return NextResponse.json([], { status: 500 });
  }
}
