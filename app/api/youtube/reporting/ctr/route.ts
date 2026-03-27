/**
 * 動画ごとの CTR・インプレッション数を返す
 *
 * GET /api/youtube/reporting/ctr?channelId=...&videoIds=id1,id2,...
 *   - Redis に保存された Reporting API データ（rpt_ctr:{channelId}:{videoId}）を返す
 *   - データがない動画は null を返す
 */
import { NextRequest, NextResponse } from "next/server";
import redis from "@/lib/redis";

type CtrRecord = {
  impressions: number;
  ctr: number;
  date: string;
};

type CtrResult = {
  videoId: string;
  impressions: number | null;
  ctr: number | null;
  date: string | null;
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const channelId = searchParams.get("channelId");
  const videoIdsParam = searchParams.get("videoIds");

  if (!channelId || !videoIdsParam) {
    return NextResponse.json(
      { error: "channelId と videoIds が必要です" },
      { status: 400 }
    );
  }

  const videoIds = videoIdsParam.split(",").filter(Boolean);
  if (!videoIds.length) {
    return NextResponse.json({ ctr: [] });
  }

  // Redis から並列取得
  const results: CtrResult[] = await Promise.all(
    videoIds.map(async (videoId) => {
      const key = `rpt_ctr:${channelId}:${videoId}`;
      const raw = await redis.get(key);
      if (!raw) {
        return { videoId, impressions: null, ctr: null, date: null };
      }
      const record = JSON.parse(raw) as CtrRecord;
      return {
        videoId,
        impressions: record.impressions,
        ctr: record.ctr,
        date: record.date,
      };
    })
  );

  return NextResponse.json({ ctr: results });
}
