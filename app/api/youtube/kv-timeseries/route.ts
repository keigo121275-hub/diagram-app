/**
 * KV 時系列 API
 *
 * POST /api/youtube/kv-timeseries  （推奨・モバイル向け）
 *   Body: { channelId, videos: [{ id, publishedAt }] }
 *   動画数が多いとき GET のクエリが URL 長制限を超え Safari 等で失敗するため POST を使う。
 *
 * GET /api/youtube/kv-timeseries?channelId=...&videos=[{id,publishedAt}]
 *   後方互換・短いリスト用
 *
 * Redis のスナップショットから投稿1/3/7/30日後の再生数を返す（ない日は null）。
 */
import { NextRequest, NextResponse } from "next/server";
import redis from "@/lib/redis";
import type { VideoTimeseries } from "@/lib/youtube/types";

export type { VideoTimeseries };

type SnapRecord = {
  views: number;
  likes: number;
  savedAt: string;
};

/** publishedAt から N 日後の YYYY-MM-DD を返す */
function addDays(publishedAt: string, days: number): string {
  const d = new Date(publishedAt);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Redis から snap:{channelId}:{videoId}:{date} を取得して views を返す */
async function getViews(
  channelId: string,
  videoId: string,
  date: string
): Promise<number | null> {
  const key = `snap:${channelId}:${videoId}:${date}`;
  const raw = await redis.get(key);
  if (!raw) return null;
  const record = JSON.parse(raw) as SnapRecord;
  return record.views;
}

async function buildTimeseries(
  channelId: string,
  videoList: { id: string; publishedAt: string }[]
): Promise<VideoTimeseries[]> {
  return Promise.all(
    videoList.map(async ({ id, publishedAt }) => {
      const [views1d, views3d, views7d, views30d] = await Promise.all([
        getViews(channelId, id, addDays(publishedAt, 1)),
        getViews(channelId, id, addDays(publishedAt, 3)),
        getViews(channelId, id, addDays(publishedAt, 7)),
        getViews(channelId, id, addDays(publishedAt, 30)),
      ]);
      return { videoId: id, views1d, views3d, views7d, views30d };
    })
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON が不正です" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }
  const { channelId, videos } = body as {
    channelId?: unknown;
    videos?: unknown;
  };
  if (typeof channelId !== "string" || !channelId) {
    return NextResponse.json({ error: "channelId が必要です" }, { status: 400 });
  }
  if (!Array.isArray(videos)) {
    return NextResponse.json({ error: "videos は配列である必要があります" }, { status: 400 });
  }
  const videoList: { id: string; publishedAt: string }[] = [];
  for (const row of videos) {
    if (!row || typeof row !== "object") continue;
    const r = row as { id?: unknown; publishedAt?: unknown };
    if (typeof r.id === "string" && typeof r.publishedAt === "string") {
      videoList.push({ id: r.id, publishedAt: r.publishedAt });
    }
  }
  if (!videoList.length) {
    return NextResponse.json({ timeseries: [] as VideoTimeseries[] });
  }
  const timeseries = await buildTimeseries(channelId, videoList);
  return NextResponse.json({ timeseries });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const channelId = searchParams.get("channelId");
  const videosParam = searchParams.get("videos");

  if (!channelId || !videosParam) {
    return NextResponse.json(
      { error: "channelId と videos が必要です" },
      { status: 400 }
    );
  }

  let videoList: { id: string; publishedAt: string }[];
  try {
    videoList = JSON.parse(videosParam);
  } catch {
    return NextResponse.json({ error: "videos の形式が不正です" }, { status: 400 });
  }

  const timeseries = await buildTimeseries(channelId, videoList);
  return NextResponse.json({ timeseries });
}
