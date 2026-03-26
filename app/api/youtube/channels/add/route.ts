/**
 * 権限共有チャンネルの追加接続API。
 * pending トークンでアクセス可否を確認し、保存する。
 */
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getPendingToken } from "@/lib/pendingTokenStore";
import { saveChannelToken } from "@/lib/channelTokenStore";

export async function POST(request: NextRequest) {
  const { channelId } = await request.json();

  if (!channelId || typeof channelId !== "string") {
    return NextResponse.json({ error: "channelId が必要です" }, { status: 400 });
  }

  const pending = getPendingToken();
  if (!pending) {
    return NextResponse.json(
      { error: "認証トークンが見つかりません。先に「Google アカウントで認証」を行ってください。" },
      { status: 401 }
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/youtube/auth/callback`
  );
  oauth2Client.setCredentials({ refresh_token: pending.refreshToken });
  const youtube = google.youtube({ version: "v3", auth: oauth2Client });

  try {
    const res = await youtube.channels.list({
      part: ["id", "snippet"],
      id: [channelId],
    });

    const ch = res.data.items?.[0];
    if (!ch || !ch.id) {
      return NextResponse.json(
        { error: "このチャンネルIDは見つかりませんでした。IDを確認してください。" },
        { status: 404 }
      );
    }

    await saveChannelToken({
      channelId: ch.id,
      channelName: ch.snippet?.title ?? "不明",
      refreshToken: pending.refreshToken,
    });

    return NextResponse.json({
      ok: true,
      channelId: ch.id,
      channelName: ch.snippet?.title ?? "不明",
    });
  } catch (err) {
    console.error("Channel add error:", err);
    return NextResponse.json(
      { error: "チャンネルへのアクセスに失敗しました。権限を確認してください。" },
      { status: 403 }
    );
  }
}
