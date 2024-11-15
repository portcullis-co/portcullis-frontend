import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/auth(.*)',
  '/api/exports(.*)',
  '/pricing',
  '/privacy',
  '/api/warehouses(.*)',
  '/invite/(.*)',
  '/syncs/(.*)',
  '/terms',
  '/api/(.*)',
  '/api/inngest(.*)',
  '/.redwood/functions/inngest(.*)',
  '/x/inngest(.*)',
  '/.netlify/functions/inngest(.*)',
  '/inngest(.*)'
]);

const allowedRoutes = [
  '/',
  '/home',
  '/auth',
  '/api/(.*)',
  '/links',
  '/api/pipeline',
  '/api/links/(.*)',
  '/api/links',
  '/api/warehouses',
  '/create-organization',
  '/api/syncs',
  '/api/check-connection',
  '/syncs/(.*)',
  '/invite/(.*)',
  '/warehouses',
  '/portal/(.*)',
];

const allowedOrigins = [
  'http://localhost:3000',
  'https://portcullis-app.fly.dev',
];

function corsMiddleware(request: NextRequest, response: NextResponse) {
  const origin = request.headers.get('origin');

  if (origin && allowedOrigins.some(allowedOrigin => origin === allowedOrigin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Info, ApiKey');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: response.headers });
  }

  return response;
}

export default clerkMiddleware(async (auth, req) => {
  const nextRequest = req as NextRequest;
  const { pathname } = nextRequest.nextUrl;

  console.log('Current path:', pathname);
  console.log('Is public route:', isPublicRoute(req));

  if (isPublicRoute(req)) {
    console.log('Allowing public route:', pathname);
    const response = NextResponse.next();
    return corsMiddleware(nextRequest, response);
  }

  const isAllowedRoute = allowedRoutes.some(route => pathname.startsWith(route));

  console.log(`Request to ${pathname} - isAllowedRoute: ${isAllowedRoute}`);
  
  if (!isAllowedRoute) {
    console.log(`Redirecting to / because route is not allowed`);
    return NextResponse.redirect(new URL('/', req.url));
  }

  const { userId } = auth();
  if (!userId) {
    console.log(`Redirecting to /sign-in because user is not authenticated`);
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }

  try {
    const user = await clerkClient.users.getUser(userId);
    const orgId = user.publicMetadata.organization_id as string;

    if (orgId) {
      const organization = await clerkClient.organizations.getOrganization({ organizationId: orgId });
      const publicMetadata = organization.publicMetadata as { status?: string };

      if (publicMetadata.status === "suspended") {
        console.log(`Redirecting to /suspended because organization is suspended`);
        return NextResponse.redirect(new URL('/suspended', req.url));
      }
    }

    auth().protect();
  } catch (error) {
    console.error('Error in middleware:', error);
    return NextResponse.redirect(new URL('/error', req.url));
  }

  const response = NextResponse.next();
  return corsMiddleware(nextRequest, response);
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};