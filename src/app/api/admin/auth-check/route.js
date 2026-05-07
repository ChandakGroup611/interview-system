import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const session = isAuthenticated(request);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, userId: session.userId });
}
