import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mock.supabase.co";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "mock-anon-key";

  // Check if we are running in mock demo mode
  const isMockMode = supabaseUrl.includes("mock.supabase.co") || !process.env.NEXT_PUBLIC_SUPABASE_URL;

  // Check demo auth cookie or mock session
  const demoAuthCookie = request.cookies.get("gridguard_demo_auth")?.value;

  if (isMockMode) {
    const isAuthRoute = request.nextUrl.pathname.startsWith("/login") || request.nextUrl.pathname.startsWith("/signup");
    const isPublic = isAuthRoute || request.nextUrl.pathname.startsWith("/_next") || request.nextUrl.pathname.startsWith("/api");

    // If accessing root, redirect to dashboard or login
    if (request.nextUrl.pathname === "/") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (!isPublic && !demoAuthCookie && !request.cookies.get("sb-access-token")) {
      // In mock mode, if not authenticated, redirect to login
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return response;
  }

  // Real Supabase Auth Flow
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: "", ...options });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup") ||
    request.nextUrl.pathname.startsWith("/auth");

  if (request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL(user ? "/dashboard" : "/login", request.url));
  }

  if (!user && !isAuthRoute && !demoAuthCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
