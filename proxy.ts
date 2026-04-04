import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { createServerClient } from "@supabase/ssr";

/**
 * ALLOWED_EMAILS が設定されているとき、環境変数に加えて常に通すメール。
 * （Vercel のリスト更新漏れでブロックされないようにする）
 */
const TEAM_EMAILS_ALWAYS_ALLOWED = [
  "keigo121275@gmail.com",
  "webblog1212@gmail.com",
  "riemom5588@gmail.com",
  "m.kajino.belle@gmail.com",
].map((e) => e.toLowerCase());

/** Gmail は local 部のドットを無視するので、照合時は正規化する */
function normalizeEmailForAllowlist(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at < 1) return trimmed;
  let local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (domain === "gmail.com" || domain === "googlemail.com") {
    local = local.replace(/\./g, "");
  }
  return `${local}@${domain}`;
}

/** カンマ区切り。未設定なら誰でも /youtube に入れる。設定時は TEAM + ここに載ったメール（GCPテストユーザーとは別） */
function getAllowedEmailsNormalized(): string[] {
  const raw = process.env.ALLOWED_EMAILS ?? "";
  const fromEnv = raw
    .split(",")
    .map((e) => normalizeEmailForAllowlist(e))
    .filter(Boolean);
  if (fromEnv.length === 0) return [];
  const team = TEAM_EMAILS_ALWAYS_ALLOWED.map((e) => normalizeEmailForAllowlist(e));
  return [...new Set([...team, ...fromEnv])];
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── すごろくロードマップ ───
  if (pathname.startsWith("/sugoroku")) {
    if (pathname === "/sugoroku/login") {
      return NextResponse.next();
    }

    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/sugoroku/login";
      return NextResponse.redirect(loginUrl);
    }

    // admin 専用ルートのガード
    if (
      pathname.startsWith("/sugoroku/admin") ||
      pathname.startsWith("/sugoroku/new-roadmap")
    ) {
      const { data: member } = await supabase
        .from("members")
        .select("role")
        .eq("id", user.id)
        .single();

      if (member?.role !== "admin") {
        const dashboardUrl = request.nextUrl.clone();
        dashboardUrl.pathname = "/sugoroku/dashboard";
        return NextResponse.redirect(dashboardUrl);
      }
    }

    return supabaseResponse;
  }

  // ─── YouTube アナリティクス ───
  if (pathname.startsWith("/youtube/login") || pathname.startsWith("/youtube/unauthorized")) {
    return NextResponse.next();
  }

  const session = await auth();

  if (!session) {
    const loginUrl = new URL("/youtube/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/youtube/connect")) {
    return NextResponse.next();
  }

  const allowedEmails = getAllowedEmailsNormalized();
  if (allowedEmails.length > 0) {
    const raw = session.user?.email?.trim() ?? "";
    const userEmail = raw ? normalizeEmailForAllowlist(raw) : "";
    if (!userEmail || !allowedEmails.includes(userEmail)) {
      const unauthorizedUrl = new URL("/youtube/unauthorized", request.url);
      return NextResponse.redirect(unauthorizedUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/youtube/:path*", "/sugoroku/:path*"],
};
