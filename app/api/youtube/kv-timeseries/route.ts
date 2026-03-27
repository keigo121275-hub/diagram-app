/**
 * KV 時系列 API
 *
 * GET /api/youtube/kv-timeseries?channelId=...&videos=[{id, publishedAt}]
 *   - Redis に保存されたスナップショットから
 *     投稿1日後・3日後・7日後・30日後の再生数を返す
 *   - スナップショットがない日付は null を返す
 */
import { NextRequest, NextResponse } from "next/server";
import redis from "@/lib/redis";

export type VideoTimeseries = {
  videoId: string;
  views1d: number | null;
  views3d: number | null;
  views7d: number | null;
  views30d: number | null;
};

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

  // 全動画について並列で Redis を参照
  const timeseries: VideoTimeseries[] = await Promise.all(
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

  return NextResponse.json({ timeseries });
}
