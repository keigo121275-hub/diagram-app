/**
 * 接続済みチャンネルの一覧を返す。
 * Blob（本番）またはローカルファイルに保存されたトークンから取得する。
 */
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getAllChannelTokens } from "@/lib/channelTokenStore";
import { Channel } from "@/lib/types";

export async function GET() {
  const tokens = await getAllChannelTokens();

  if (tokens.length === 0) {
    return NextResponse.json(
      { error: "チャンネルが未接続です。/youtube/connect から接続してください。" },
      { status: 401 }
    );
  }

  const channels: Channel[] = [];

  for (const token of tokens) {
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${process.env.NEXTAUTH_URL}/api/youtube/auth/callback`
      );
      oauth2Client.setCredentials({ refresh_token: token.refreshToken });
      const youtube = google.youtube({ version: "v3", auth: oauth2Client });

      const res = await youtube.channels.list({
        part: ["id", "snippet", "contentDetails", "statistics"],
        id: [token.channelId],
      });

      const ch = res.data.items?.[0];
      if (!ch) continue;

      channels.push({
        id: ch.id ?? token.channelId,
        name: ch.snippet?.title ?? token.channelName,
        thumbnail: ch.snippet?.thumbnails?.default?.url ?? "",
        subscriberCount: ch.statistics?.subscriberCount ?? "0",
        videoCount: ch.statistics?.videoCount ?? "0",
        uploadsPlaylistId: ch.contentDetails?.relatedPlaylists?.uploads ?? "",
      });
    } catch (err) {
      console.error(`Channel fetch error for ${token.channelId}:`, err);
    }
  }

  return NextResponse.json({ channels });
}
