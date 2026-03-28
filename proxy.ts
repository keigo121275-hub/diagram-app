import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";

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

/** カンマ区切り。未設定なら誰でも /youtube に入れる。設定時は TEAM + ここに載ったメール（GCPテストユーザーとは別） */
function getAllowedEmails(): string[] {
  const raw = process.env.ALLOWED_EMAILS ?? "";
  const fromEnv = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (fromEnv.length === 0) return [];
  return [...new Set([...TEAM_EMAILS_ALWAYS_ALLOWED, ...fromEnv])];
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ログインページ・未承認ページはスキップ（無限リダイレクト防止）
  if (
    pathname.startsWith("/youtube/login") ||
    pathname.startsWith("/youtube/unauthorized")
  ) {
    return NextResponse.next();
  }

  const session = await auth();

  if (!session) {
    const loginUrl = new URL("/youtube/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // /youtube/connect はログイン済みなら誰でもアクセス可（チャンネルオーナー用）
  if (pathname.startsWith("/youtube/connect")) {
    return NextResponse.next();
  }

  // 分析画面はホワイトリストのみ
  const allowedEmails = getAllowedEmails();
  if (allowedEmails.length > 0) {
    const userEmail = session.user?.email?.toLowerCase() ?? "";
    if (!allowedEmails.includes(userEmail)) {
      const unauthorizedUrl = new URL("/youtube/unauthorized", request.url);
      return NextResponse.redirect(unauthorizedUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/youtube/:path*"],
};
