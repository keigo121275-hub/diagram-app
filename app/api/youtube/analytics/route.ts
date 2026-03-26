/**
 * 動画ごとの YouTube Analytics データを返す。
 *
 * クエリパラメータ:
 *   - channelId:  接続済みチャンネルのID
 *   - videoIds:   カンマ区切りの動画ID（最大50件）
 *
 * レスポンス:
 *   - analytics: VideoAnalytics[]
 *   - forbidden: true（権限なしの場合）
 *
 * 取得する指標:
 *   - impressionClickThroughRate  → CTR（インプレッション→クリック率）
 *   - averageViewPercentage       → 平均視聴維持率（%）
 */
import { NextRequest, NextResponse } from "next/server";
import { getYoutubeAnalyticsClient } from "@/lib/getYoutubeAnalyticsClient";

export type VideoAnalytics = {
  videoId: string;
  ctr: number | null;
  avgViewPercent: number | null;
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const channelId = searchParams.get("channelId");
  const videoIds = searchParams.get("videoIds");

  if (!channelId || !videoIds) {
    return NextResponse.json(
      { error: "channelId と videoIds が必要です" },
      { status: 400 }
    );
  }

  const client = await getYoutubeAnalyticsClient(channelId);
  if (!client) {
    return NextResponse.json({ error: "未接続" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];
  const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const baseQuery = {
    ids: `channel==${channelId}`,
    startDate: twoYearsAgo,
    endDate: today,
    dimensions: "video" as const,
    filters: `video==${videoIds}`,
    maxResults: 200,
  };

  try {
    // impressionClickThroughRate と averageViewPercentage は別グループのため
    // 同一クエリに混在不可 → 2つのリクエストに分けて並行取得する
    const [retentionResult, ctrResult] = await Promise.allSettled([
      client.reports.query({ ...baseQuery, metrics: "averageViewPercentage" }),
      client.reports.query({ ...baseQuery, metrics: "impressionClickThroughRate" }),
    ]);

    // 視聴維持率のマップを作る
    const retentionMap = new Map<string, number>();
    if (retentionResult.status === "fulfilled") {
      const headers = (retentionResult.value.data.columnHeaders ?? []).map((h) => h.name ?? "");
      const rows = (retentionResult.value.data.rows ?? []) as (string | number | null)[][];
      const vIdx = headers.indexOf("video");
      const rIdx = headers.indexOf("averageViewPercentage");
      for (const row of rows) {
        if (vIdx >= 0 && rIdx >= 0 && row[vIdx] && row[rIdx] != null) {
          retentionMap.set(row[vIdx] as string, row[rIdx] as number);
        }
      }
    }

    // CTR のマップを作る
    const ctrMap = new Map<string, number>();
    if (ctrResult.status === "fulfilled") {
      const headers = (ctrResult.value.data.columnHeaders ?? []).map((h) => h.name ?? "");
      const rows = (ctrResult.value.data.rows ?? []) as (string | number | null)[][];
      const vIdx = headers.indexOf("video");
      const cIdx = headers.indexOf("impressionClickThroughRate");
      for (const row of rows) {
        if (vIdx >= 0 && cIdx >= 0 && row[vIdx] && row[cIdx] != null) {
          ctrMap.set(row[vIdx] as string, row[cIdx] as number);
        }
      }
    }

    // 取得できた動画ID の全体 = 両マップのキーをマージ
    const allVideoIds = Array.from(
      new Set([...retentionMap.keys(), ...ctrMap.keys()])
    );

    const analytics: VideoAnalytics[] = allVideoIds.map((videoId) => ({
      videoId,
      ctr: ctrMap.get(videoId) ?? null,
      avgViewPercent: retentionMap.get(videoId) ?? null,
    }));

    // 両方 403 の場合は権限なしとして返す
    const both403 =
      retentionResult.status === "rejected" &&
      ctrResult.status === "rejected" &&
      (retentionResult.reason as { status?: number })?.status === 403;

    if (both403) {
      return NextResponse.json(
        { forbidden: true, error: "このチャンネルのアナリティクスにアクセスする権限がありません" },
        { status: 403 }
      );
    }

    return NextResponse.json({ analytics });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status === 403) {
      return NextResponse.json(
        { forbidden: true, error: "このチャンネルのアナリティクスにアクセスする権限がありません" },
        { status: 403 }
      );
    }
    console.error("YouTube Analytics API error:", err);
    return NextResponse.json(
      { error: "アナリティクスの取得に失敗しました" },
      { status: 500 }
    );
  }
}
