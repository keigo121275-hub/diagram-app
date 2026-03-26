import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { saveChannelToken } from "@/lib/channelTokenStore";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL("/youtube/connect?error=auth_failed", request.url)
    );
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/youtube/auth/callback`
    );

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return NextResponse.redirect(
        new URL("/youtube/connect?error=no_refresh_token", request.url)
      );
    }

    // チャンネル名を取得して一緒に保存
    oauth2Client.setCredentials(tokens);
    const youtube = google.youtube({ version: "v3", auth: oauth2Client });
    const channelRes = await youtube.channels.list({
      part: ["snippet"],
      mine: true,
    });
    const channelName = channelRes.data.items?.[0]?.snippet?.title ?? "不明";

    saveChannelToken({
      refreshToken: tokens.refresh_token,
      channelName,
    });

    const params = new URLSearchParams({
      success: "true",
      channelName,
      refreshToken: tokens.refresh_token,
    });

    return NextResponse.redirect(
      new URL(`/youtube/connect?${params.toString()}`, request.url)
    );
  } catch (err) {
    console.error("OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/youtube/connect?error=token_failed", request.url)
    );
  }
}
