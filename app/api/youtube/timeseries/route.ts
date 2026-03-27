/**
 * 動画ごとの時系列再生数を返す。
 *
 * クエリパラメータ:
 *   - channelId:    接続済みチャンネルのID
 *   - videos:       JSON文字列 { id: string; publishedAt: string }[]
 *
 * レスポンス:
 *   - timeseries: VideoTimeseries[]
 *
 * 仕組み:
 *   YouTube Analytics API に dimensions="video,day" で1回だけリクエストし、
 *   全動画の日別再生数をまとめて取得する。
 *   サーバー側で各動画の公開日を基準に 1d / 3d / 7d / 30d の累計を計算して返す。
 *   （50本 × 1リクエスト ではなく 1リクエスト で済む）
 */
import { NextRequest, NextResponse } from "next/server";
import { getYoutubeAnalyticsClient } from "@/lib/getYoutubeAnalyticsClient";

export type VideoTimeseries = {
  videoId: string;
  views1d:  number | null;
  views3d:  number | null;
  views7d:  number | null;
  views30d: number | null;
};

type VideoInput = {
  id: string;
  publishedAt: string; // ISO 8601 例: "2026-01-15T10:00:00Z"
};

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

  let videos: VideoInput[];
  try {
    videos = JSON.parse(videosParam);
  } catch {
    return NextResponse.json({ error: "videos の形式が不正です" }, { status: 400 });
  }

  if (videos.length === 0) {
    return NextResponse.json({ timeseries: [] });
  }

  const client = await getYoutubeAnalyticsClient(channelId);
  if (!client) {
    return NextResponse.json({ error: "未接続" }, { status: 401 });
  }

  // 最も古い公開日を startDate とする（それ以前のデータは不要）
  const publishedDates = videos.map((v) => v.publishedAt.split("T")[0]);
  const startDate = publishedDates.reduce((a, b) => (a < b ? a : b));
  const today = new Date().toISOString().split("T")[0];
  const videoIds = videos.map((v) => v.id).join(",");

  try {
    // 全動画の日別再生数を1回のリクエストで取得する
    const result = await client.reports.query({
      ids: `channel==${channelId}`,
      startDate,
      endDate: today,
      dimensions: "video,day",
      filters: `video==${videoIds}`,
      metrics: "views",
      maxResults: 200,
      sort: "video,day",
    });

    const headers = (result.data.columnHeaders ?? []).map((h) => h.name ?? "");
    const rows = (result.data.rows ?? []) as (string | number | null)[][];
    console.log("[Timeseries] headers:", headers, "rows count:", rows.length, "sample:", rows.slice(0, 3));
    const vIdx = headers.indexOf("video");
    const dIdx = headers.indexOf("day");
    const wIdx = headers.indexOf("views");

    // 動画IDをキーに「日付 → 再生数」のマップを作る
    const dailyMap = new Map<string, Map<string, number>>();
    for (const row of rows) {
      const videoId = row[vIdx] as string;
      const day     = row[dIdx] as string;
      const views   = row[wIdx] as number ?? 0;
      if (!dailyMap.has(videoId)) {
        dailyMap.set(videoId, new Map());
      }
      dailyMap.get(videoId)!.set(day, views);
    }

    // 各動画の公開日を基準に 1d / 3d / 7d / 30d の累計を計算する
    const timeseries: VideoTimeseries[] = videos.map((video) => {
      const pubDate = video.publishedAt.split("T")[0];
      const dayViews = dailyMap.get(video.id);

      if (!dayViews) {
        return { videoId: video.id, views1d: null, views3d: null, views7d: null, views30d: null };
      }

      const cumulative = (days: number): number | null => {
        let total = 0;
        let hasData = false;
        for (let i = 0; i < days; i++) {
          const date = offsetDate(pubDate, i);
          if (dayViews.has(date)) {
            total += dayViews.get(date)!;
            hasData = true;
          }
        }
        return hasData ? total : null;
      };

      return {
        videoId:  video.id,
        views1d:  cumulative(1),
        views3d:  cumulative(3),
        views7d:  cumulative(7),
        views30d: cumulative(30),
      };
    });

    return NextResponse.json({ timeseries });
  } catch (err: unknown) {
    console.error("YouTube Timeseries API error:", err);
    return NextResponse.json(
      { error: "時系列データの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// YYYY-MM-DD に n 日加算した文字列を返す
function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}
