import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('jobhub_token')?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/jobs/:path*',
    '/applications/:path*',
    '/resume/:path*',
    '/settings/:path*',
    '/onboarding/:path*',
    '/onboarding',
  ],
}
