/**
 * スナップショット API
 *
 * POST /api/youtube/snapshot
 *   - 指定チャンネルの全動画の今日の再生数・いいね数を Redis に保存する
 *   - キー: snap:{channelId}:{videoId}:{YYYY-MM-DD}
 *   - 50本を超える動画はページネーションで全取得
 *
 * GET /api/youtube/snapshot?channelId=...&videoId=...
 *   - 特定動画のスナップショット一覧を返す（デバッグ用）
 */
import { NextRequest, NextResponse } from "next/server";
import { getYoutubeClient } from "@/lib/getYoutubeClient";
import redis from "@/lib/redis";
import { youtube_v3 } from "googleapis";
import type { GaxiosResponseWithHTTP2 } from "googleapis-common";

export type SnapRecord = {
  views: number;
  likes: number;
  savedAt: string; // ISO timestamp
};

function todayJST(): string {
  // JSTで今日の日付を YYYY-MM-DD 形式で返す
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

/** uploadsPlaylistId から全動画IDをページネーションで取得 */
async function fetchAllVideoIds(
  youtube: youtube_v3.Youtube,
  uploadsPlaylistId: string
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined = undefined;

  let hasMore = true;
  while (hasMore) {
    const res: GaxiosResponseWithHTTP2<youtube_v3.Schema$PlaylistItemListResponse> =
      await youtube.playlistItems.list({
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
    hasMore = !!pageToken;
  }

  return ids;
}

// ---------------------------------------------------------------------------
// POST: 全動画のスナップショットを保存
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const channelId: string | undefined = body.channelId;
  const uploadsPlaylistId: string | undefined = body.uploadsPlaylistId;

  if (!channelId || !uploadsPlaylistId) {
    return NextResponse.json(
      { error: "channelId と uploadsPlaylistId が必要です" },
      { status: 400 }
    );
  }

  const youtube = await getYoutubeClient(channelId);
  if (!youtube) {
    return NextResponse.json(
      { error: "チャンネルが未接続です" },
      { status: 401 }
    );
  }

  try {
    const today = todayJST();
    const videoIds = await fetchAllVideoIds(youtube, uploadsPlaylistId);

    if (!videoIds.length) {
      return NextResponse.json({ saved: 0, skipped: 0, date: today });
    }

    // 50本ずつ分割して statistics を取得
    let saved = 0;
    let skipped = 0;
    const chunks: string[][] = [];
    for (let i = 0; i < videoIds.length; i += 50) {
      chunks.push(videoIds.slice(i, i + 50));
    }

    for (const chunk of chunks) {
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
        // 90日間保持（TTL: 90日 × 86400秒）
        pipeline.set(key, JSON.stringify(record), "EX", 90 * 86400);
        saved++;
      }
      await pipeline.exec();
    }

    console.log(
      `[Snapshot] ${today} channelId=${channelId} saved=${saved} skipped=${skipped}`
    );
    return NextResponse.json({ saved, skipped, date: today });
  } catch (err) {
    console.error("[Snapshot] error:", err);
    return NextResponse.json(
      { error: "スナップショットの保存に失敗しました" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// GET: デバッグ用 — 特定動画のスナップショットを返す
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const channelId = searchParams.get("channelId");
  const videoId = searchParams.get("videoId");

  if (!channelId || !videoId) {
    return NextResponse.json(
      { error: "channelId と videoId が必要です" },
      { status: 400 }
    );
  }

  const pattern = `snap:${channelId}:${videoId}:*`;
  const keys = await redis.keys(pattern);
  keys.sort();

  const results: { date: string; record: SnapRecord }[] = [];
  for (const key of keys) {
    const raw = await redis.get(key);
    if (!raw) continue;
    const date = key.split(":").pop() ?? "";
    results.push({ date, record: JSON.parse(raw) as SnapRecord });
  }

  return NextResponse.json({ videoId, snapshots: results });
}
