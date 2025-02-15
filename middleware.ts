import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Check for Firebase ID token in cookies
  const authCookie = request.cookies.get('__session')
  const firebaseToken = request.cookies.get('firebaseToken')
  
  // List of paths that require authentication
  const protectedPaths = ['/profile', '/dashboard']
  const adminPaths = ['/admin']
  
  // Check if the requested path is protected or admin
  const isProtectedPath = protectedPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  )
  const isAdminPath = adminPaths.some(path =>
    request.nextUrl.pathname.startsWith(path)
  )

  // If it's a protected path and user is not authenticated
  if ((isProtectedPath || isAdminPath) && (!authCookie && !firebaseToken)) {
    // Redirect to auth page with the original URL as redirect parameter
    const redirectUrl = new URL('/auth', request.url)
    redirectUrl.protocol = 'http:' // Force http for localhost
    redirectUrl.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // If it's the auth page and user is authenticated
  if (request.nextUrl.pathname === '/auth' && (authCookie || firebaseToken)) {
    // Redirect to the original requested URL or home
    const redirectTo = request.nextUrl.searchParams.get('redirect') || '/'
    const targetUrl = new URL(redirectTo, request.url)
    targetUrl.protocol = 'http:' // Force http for localhost
    return NextResponse.redirect(targetUrl)
  }

  // Allow the request to proceed
  const response = NextResponse.next()
  
  // Ensure we're using http for localhost
  if (process.env.NODE_ENV === 'development') {
    response.headers.set('X-Forwarded-Proto', 'http')
  }
  
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * 1. /api/ (API routes)
     * 2. /_next/ (Next.js internals)
     * 3. /_static (inside /public)
     * 4. /_vercel (Vercel internals)
     * 5. /favicon.ico, /sitemap.xml (static files)
     */
    '/((?!api|_next|_static|_vercel|favicon.ico|sitemap.xml).*)',
  ],
} 