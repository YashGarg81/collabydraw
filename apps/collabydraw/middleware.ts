import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { checkRateLimit } from "./utils/rate-limit";

// Custom middleware combining rate limiting and auth
export default withAuth(
  async function middleware(req) {
    // Determine the type of request for rate limiting
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const path = req.nextUrl.pathname;

    let limitType: "global" | "ai" | "auth" | "websocket" = "global";
    
    if (path.startsWith("/api/ai")) limitType = "ai";
    else if (path.startsWith("/api/auth")) limitType = "auth";
    else if (path.startsWith("/api/ws")) limitType = "websocket";

    const { success, limit, reset, remaining } = await checkRateLimit(`${limitType}_${ip}`, limitType);

    if (!success) {
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
        },
      });
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/auth/signin",
    },
    callbacks: {
      authorized: ({ req, token }) => {
        const path = req.nextUrl.pathname;
        // Require auth for these paths
        if (
          path.startsWith("/dashboard") ||
          path.startsWith("/chat-room") ||
          path.startsWith("/settings")
        ) {
          return !!token;
        }
        // Other paths don't strictly require auth at the middleware level
        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};