/**
 * Vercel Cron エンドポイント
 *
 * GET /api/cron/snapshot
 *   - vercel.json の crons で毎日 0:00 UTC（9:00 JST）に自動実行される
 *   - 登録済み全チャンネルのスナップショットを保存する
 *   - Authorization: Bearer <CRON_SECRET> で認証（Vercel が自動付与）
 */
import { NextRequest, NextResponse } from "next/server";
import { getAllChannelTokens } from "@/lib/channelTokenStore";
import { getYoutubeClient } from "@/lib/getYoutubeClient";
import redis from "@/lib/redis";

export const dynamic = "force-dynamic";

type SnapRecord = {
  views: number;
  likes: number;
  savedAt: string;
};

function todayJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

async function fetchAllVideoIds(
  youtube: Awaited<ReturnType<typeof getYoutubeClient>>,
  uploadsPlaylistId: string
): Promise<string[]> {
  if (!youtube) return [];
  const ids: string[] = [];
  let pageToken: string | undefined = undefined;

  do {
    const res = await youtube.playlistItems.list({
      part: ["contentDetails"],
      playlistId: uploadsPlaylistId,
      maxResults: 50,
      pageToken,
    });
    const batch =
      res.data.items
        ?.map((item) => item.contentDetails?.videoId)
        .filter(Boolean) as string[];
    ids.push(...batch);
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return ids;
}

async function saveSnapshotForChannel(
  channelId: string,
  uploadsPlaylistId: string
): Promise<number> {
  const youtube = await getYoutubeClient(channelId);
  if (!youtube) return 0;

  const today = todayJST();
  const videoIds = await fetchAllVideoIds(youtube, uploadsPlaylistId);
  if (!videoIds.length) return 0;

  let saved = 0;
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    const statsRes = await youtube.videos.list({
      part: ["statistics"],
      id: chunk,
    });

    const pipeline = redis.pipeline();
    for (const item of statsRes.data.items ?? []) {
      if (!item.id) continue;
      const key = `snap:${channelId}:${item.id}:${today}`;
      const record: SnapRecord = {
        views: Number(item.statistics?.viewCount ?? 0),
        likes: Number(item.statistics?.likeCount ?? 0),
        savedAt: new Date().toISOString(),
      };
      pipeline.set(key, JSON.stringify(record), "EX", 90 * 86400);
      saved++;
    }
    await pipeline.exec();
  }

  return saved;
}

export async function GET(request: NextRequest) {
  // Vercel Cron は Authorization: Bearer <CRON_SECRET> を付与する
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const channels = await getAllChannelTokens();
  if (!channels.length) {
    return NextResponse.json({ message: "接続済みチャンネルがありません", saved: 0 });
  }

  const results: { channelId: string; saved: number; error?: string }[] = [];
  const today = todayJST();

  for (const ch of channels) {
    // uploadsPlaylistId は channelId の先頭2文字(UC)を UU に置換したもの
    const uploadsPlaylistId = ch.channelId.replace(/^UC/, "UU");
    try {
      const saved = await saveSnapshotForChannel(ch.channelId, uploadsPlaylistId);
      results.push({ channelId: ch.channelId, saved });
      console.log(`[Cron] ${today} channelId=${ch.channelId} saved=${saved}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown error";
      results.push({ channelId: ch.channelId, saved: 0, error: msg });
      console.error(`[Cron] ${ch.channelId} error:`, msg);
    }
  }

  return NextResponse.json({ date: today, results });
}
