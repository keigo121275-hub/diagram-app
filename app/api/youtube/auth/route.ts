/**
 * YouTube OAuth 認証 URL を生成してリダイレクトする。
 *
 * state パラメータをセットしてクッキーに保存する。
 * コールバック時に照合して CSRF 攻撃を防ぐ（Google の OAuth 2.0 ポリシー要件）。
 */
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  const redirect = request.nextUrl.searchParams.get("redirect") === "1";

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/youtube/auth/callback`
  );

  const state = crypto.randomBytes(16).toString("hex");

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    state,
    scope: [
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/yt-analytics.readonly",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
  });

  const response = redirect
    ? NextResponse.redirect(url)
    : NextResponse.json({ url });

  // state をクッキーに保存（コールバック時に検証する）
  response.cookies.set("youtube_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10, // 10分
    path: "/",
  });

  return response;
}
