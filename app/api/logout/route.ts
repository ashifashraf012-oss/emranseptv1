import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL('/login', request.url));
  response.cookies.delete('admin_session');
  return response;
}

export async function POST() {
  const response = NextResponse.json({ success: true, redirect: '/login' });
  response.cookies.delete('admin_session');
  return response;
}
