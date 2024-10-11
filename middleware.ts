import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  '/auth',
  '/auth/(.*)',
  '/pricing',
  '/privacy',
  '/portal/(.*)',
  '/sign-up',
  '/sign-in',
  '/import/(.*)',
  '/terms',
  '/api/(.*)',
  '/api/webhooks(.*)'
]);

const allowedRoutes = [
  '/home',
  '/auth',
  '/api/(.*)',
  '/api/webhooks(.*)',
  '/api/sources(.*)',
  '/api/links(.*)',
  '/api/sources',
  '/api/import',
  '/import/(.*)',
  '/import/lDF3tpEADq',
  '/sources',
  '/sign-in',
  '/sign-up',
  '/api/import(.*)',
  '/api/export(.*)',
  '/portal/(.*)',
  '/import/(.*)',
  '/export/(.*)'
];

const allowedOrigins = [
  'http://localhost:3000',
  'https://7400-2600-1700-3aa5-b800-e4c8-961a-e731-bd60.ngrok-free.app'
];

function corsMiddleware(request: NextRequest, response: NextResponse) {
  const origin = request.headers.get('origin') ?? '';

  if (allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
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
  const isAllowedRoute = allowedRoutes.some(route => pathname.startsWith(route));

  console.log(`Request to ${pathname} - isAllowedRoute: ${isAllowedRoute}`);

  if (req.headers.get('x-forwarded-proto') !== 'https') {
    return NextResponse.redirect(`https://${req.headers.get('host')}${req.nextUrl.pathname}`, 301);
  }
  if (!isPublicRoute(req)) {
    const { userId } = auth();

    if (!userId) {
      console.log(`Redirecting to /sign-up because user is not authenticated`);
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