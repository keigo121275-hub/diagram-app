/**
 * YouTube OAuth コールバック
 *
 * 1. state を検証して CSRF を防ぐ
 * 2. 認証コードをリフレッシュトークンに交換する
 * 3. mine:true で自分所有チャンネルを Blob（本番）またはファイル（ローカル）に保存する
 * 4. pending トークンとして一時保存（権限共有CHの追加接続用）
 */
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { saveChannelToken } from "@/lib/channelTokenStore";
import { savePendingToken } from "@/lib/pendingTokenStore";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL("/youtube/connect?error=auth_failed", request.url)
    );
  }

  const savedState = request.cookies.get("youtube_oauth_state")?.value;
  if (!savedState || savedState !== state) {
    return NextResponse.redirect(
      new URL("/youtube/connect?error=state_mismatch", request.url)
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

    savePendingToken(tokens.refresh_token);

    oauth2Client.setCredentials(tokens);
    const youtube = google.youtube({ version: "v3", auth: oauth2Client });

    const channelRes = await youtube.channels.list({
      part: ["id", "snippet"],
      mine: true,
    });

    const ownedChannels = channelRes.data.items ?? [];
    for (const ch of ownedChannels) {
      const channelId = ch.id ?? "";
      const channelName = ch.snippet?.title ?? "不明";
      if (!channelId) continue;
      await saveChannelToken({ channelId, channelName, refreshToken: tokens.refresh_token });
    }

    const params = new URLSearchParams({ step: "add-managed" });
    if (ownedChannels.length > 0) {
      params.set("autoAdded", ownedChannels[0]?.snippet?.title ?? "不明");
      params.set("autoCount", String(ownedChannels.length));
    }

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
