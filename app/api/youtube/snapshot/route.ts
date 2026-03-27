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
import { getYoutubeAnalyticsClient } from "@/lib/getYoutubeAnalyticsClient";
import redis from "@/lib/redis";
import { youtube_v3 } from "googleapis";
import type { GaxiosResponseWithHTTP2 } from "googleapis-common";

export type SnapRecord = {
  views: number;
  likes: number;
  avgViewPercent: number | null; // 視聴維持率（%）
  ctr: number | null;            // サムネタップ率（0〜1）
  savedAt: string;
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

type AnalyticsRecord = { avgViewPercent: number | null; ctr: number | null };

/**
 * Analytics API から動画ごとの維持率・CTR を取得する。
 * CTR が取得できない場合は null を返す（エラーは握り潰す）。
 */
async function fetchAnalytics(
  channelId: string,
  videoIds: string[]
): Promise<Map<string, AnalyticsRecord>> {
  const map = new Map<string, AnalyticsRecord>();
  if (!videoIds.length) return map;

  const client = await getYoutubeAnalyticsClient(channelId);
  if (!client) return map;

  const today = new Date().toISOString().slice(0, 10);
  const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  // 50本ずつ分けてクエリ（Analytics API の filters 上限対策）
  const chunks: string[][] = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    chunks.push(videoIds.slice(i, i + 50));
  }

  for (const chunk of chunks) {
    const filter = chunk.join(",");

    // ① 維持率 + CTR を同時取得（CTR が取れればラッキー）
    try {
      const res = await client.reports.query({
        ids: `channel==${channelId}`,
        startDate: twoYearsAgo,
        endDate: today,
        dimensions: "video",
        filters: `video==${filter}`,
        metrics: "averageViewPercentage,impressionsClickThroughRate",
        maxResults: 200,
      });
      const headers = (res.data.columnHeaders ?? []).map((h) => h.name ?? "");
      const rows = (res.data.rows ?? []) as (string | number | null)[][];
      const vIdx = headers.indexOf("video");
      const rIdx = headers.indexOf("averageViewPercentage");
      const cIdx = headers.indexOf("impressionsClickThroughRate");

      for (const row of rows) {
        const id = row[vIdx] as string;
        if (!id) continue;
        map.set(id, {
          avgViewPercent: rIdx >= 0 && row[rIdx] != null ? (row[rIdx] as number) : null,
          ctr: cIdx >= 0 && row[cIdx] != null ? (row[cIdx] as number) : null,
        });
      }
      continue; // 成功したら次チャンクへ
    } catch {
      // CTR 込みクエリが失敗した場合、維持率だけで再試行
    }

    // ② フォールバック: 維持率のみ
    try {
      const res = await client.reports.query({
        ids: `channel==${channelId}`,
        startDate: twoYearsAgo,
        endDate: today,
        dimensions: "video",
        filters: `video==${filter}`,
        metrics: "averageViewPercentage",
        maxResults: 200,
      });
      const headers = (res.data.columnHeaders ?? []).map((h) => h.name ?? "");
      const rows = (res.data.rows ?? []) as (string | number | null)[][];
      const vIdx = headers.indexOf("video");
      const rIdx = headers.indexOf("averageViewPercentage");

      for (const row of rows) {
        const id = row[vIdx] as string;
        if (!id) continue;
        map.set(id, {
          avgViewPercent: rIdx >= 0 && row[rIdx] != null ? (row[rIdx] as number) : null,
          ctr: null,
        });
      }
    } catch {
      // 完全失敗は無視（再生数だけで記録を続ける）
    }
  }

  return map;
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

    // Analytics データ（維持率・CTR）を取得
    const analyticsMap = await fetchAnalytics(channelId, videoIds);

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
        const analytics = analyticsMap.get(item.id);
        const record: SnapRecord = {
          views: Number(item.statistics?.viewCount ?? 0),
          likes: Number(item.statistics?.likeCount ?? 0),
          avgViewPercent: analytics?.avgViewPercent ?? null,
          ctr: analytics?.ctr ?? null,
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
