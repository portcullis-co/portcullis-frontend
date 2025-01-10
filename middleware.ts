import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/auth(.*)',
  '/api(.*)',
]);

const allowedRoutes = [
  '/portal',
  '/home',
  '/auth',
  '/api/webhooks/clerk',
  '/api/webhooks/stripe',
  '/api/endpoints',
  '/api/billing',
  '/api/keys',
  '/settings',
  '/create-organization',
  '/sign-in',
  '/sign-up',
  '/error'
];

const allowedOrigins = [
  'http://localhost:3000',
  'https://app.runportcullis.co',
  'https://portcullis-frontend-kl2dr7g2n-runportcullis.vercel.app/'
];

async function getUserPortalId(orgId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('portals')
      .select('id')
      .eq('organization', orgId)
      .single();

    if (error || !data) {
      console.error('Error fetching portalId:', error);
      return null;
    }

    return data.id;
  } catch (error) {
    console.error('Error in getUserPortalId:', error);
    return null;
  }
}

function corsMiddleware(request: NextRequest, response: NextResponse) {
  const origin = request.headers.get('origin');
  
  if (request.method === 'OPTIONS') {
    const headers = new Headers({
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, ApiKey',
      'Access-Control-Allow-Credentials': 'true',
    });
    return new NextResponse(null, { status: 204, headers });
  }

  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Info, ApiKey');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  return response;
}

export default clerkMiddleware(async (auth, req) => {
  const nextRequest = req as NextRequest;
  const { pathname } = nextRequest.nextUrl;

  // Don't process _next or static files
  if (pathname.startsWith('/_next') || pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js)$/)) {
    return NextResponse.next();
  }

  // Handle public routes
  if (isPublicRoute(req)) {
    const response = NextResponse.next();
    return corsMiddleware(nextRequest, response);
  }

  // Get auth state
  const { userId, orgId } = auth();

  // If user is trying to access auth pages while logged in, redirect to their portal
  if ((pathname === '/sign-in' || pathname === '/sign-up') && userId && orgId) {
    const portalId = await getUserPortalId(orgId);
    if (portalId) {
      const portalUrl = new URL('/portal/settings', req.url);
      portalUrl.searchParams.set('portalId', portalId);
      return NextResponse.redirect(portalUrl);
    }
  }

  // If not authenticated and trying to access protected route, redirect to sign-in
  if (!userId && !isPublicRoute(req)) {
    const signInUrl = new URL('/sign-in', req.url);
    signInUrl.searchParams.set('redirect_url', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // If authenticated but no organization, redirect to create organization
  if (userId && !orgId && pathname !== '/create-organization') {
    const createOrgUrl = new URL('/create-organization', req.url);
    return NextResponse.redirect(createOrgUrl);
  }

  // Handle root path redirect
  if (pathname === '/' && userId && orgId) {
    const portalId = await getUserPortalId(orgId);
    if (portalId) {
      const portalUrl = new URL('/portal/settings', req.url);
      portalUrl.searchParams.set('portalId', portalId);
      return NextResponse.redirect(portalUrl);
    }
    return NextResponse.redirect(new URL('/error', req.url));
  }

  // Handle portal access and redirects
  if (userId && orgId && pathname.startsWith('/portal')) {
    const userPortalId = await getUserPortalId(orgId);
    
    if (!userPortalId) {
      return NextResponse.redirect(new URL('/error', req.url));
    }

    // Get the current portalId from query params
    const currentPortalId = nextRequest.nextUrl.searchParams.get('portalId');

    // If no portalId in query or different from user's portal, redirect to correct portal
    if (!currentPortalId || currentPortalId !== userPortalId) {
      const portalUrl = new URL(pathname, req.url);
      portalUrl.searchParams.set('portalId', userPortalId);
      return NextResponse.redirect(portalUrl);
    }
  }

  // For all other cases, allow the request to proceed
  const response = NextResponse.next();
  return corsMiddleware(nextRequest, response);
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};