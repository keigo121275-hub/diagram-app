/**
 * YouTube Analytics データを返す。
 *
 * クエリパラメータ:
 *   - channelId:  接続済みチャンネルのID
 *   - videoIds:   カンマ区切りの動画ID（最大50件）
 *
 * レスポンス:
 *   - analytics: VideoAnalytics[]  動画ごとの視聴維持率
 *   - channelCtr: number | null    チャンネル全体のCTR（動画ごとには取得不可）
 *   - forbidden: true（権限なしの場合）
 *
 * YouTube Analytics API の制約:
 *   - averageViewPercentage は動画ごと（video ディメンション）で取得可能
 *   - videoThumbnailImpressionsClickRate は insightTrafficSourceType ディメンションが必須
 *     → 流入元ごとに取得し、インプレッション数で加重平均してチャンネル全体CTRを算出
 */
import { NextRequest, NextResponse } from "next/server";
import { getYoutubeAnalyticsClient } from "@/lib/getYoutubeAnalyticsClient";

export type VideoAnalytics = {
  videoId: string;
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

  try {
    const [retentionResult, channelCtrResult] = await Promise.allSettled([
      // 動画ごとの視聴維持率
      client.reports.query({
        ids: `channel==${channelId}`,
        startDate: twoYearsAgo,
        endDate: today,
        dimensions: "video",
        filters: `video==${videoIds}`,
        metrics: "averageViewPercentage",
        maxResults: 200,
      }),
      // 流入元ごとのインプレッション数とCTRを取得
      // （CTRは単独取得不可のため insightTrafficSourceType ディメンションが必須）
      client.reports.query({
        ids: `channel==${channelId}`,
        startDate: twoYearsAgo,
        endDate: today,
        dimensions: "insightTrafficSourceType",
        metrics: "videoThumbnailImpressions,videoThumbnailImpressionsClickRate",
      }),
    ]);

    // 動画ごとの視聴維持率マップを作る
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

    // 流入元ごとのデータからチャンネル全体のCTRを加重平均で計算する
    // 計算式：Σ(流入元ごとのインプレッション × CTR) ÷ 全インプレッション合計
    let channelCtr: number | null = null;
    if (channelCtrResult.status === "fulfilled") {
      const headers = (channelCtrResult.value.data.columnHeaders ?? []).map((h) => h.name ?? "");
      const rows = (channelCtrResult.value.data.rows ?? []) as (string | number | null)[][];
      const impIdx = headers.indexOf("videoThumbnailImpressions");
      const ctrIdx = headers.indexOf("videoThumbnailImpressionsClickRate");
      if (impIdx >= 0 && ctrIdx >= 0 && rows.length > 0) {
        let totalImpressions = 0;
        let weightedCtrSum = 0;
        for (const row of rows) {
          const imp = row[impIdx] as number ?? 0;
          const ctr = row[ctrIdx] as number ?? 0;
          totalImpressions += imp;
          weightedCtrSum += imp * ctr;
        }
        if (totalImpressions > 0) {
          channelCtr = weightedCtrSum / totalImpressions;
        }
      }
    }

    const analytics: VideoAnalytics[] = Array.from(retentionMap.entries()).map(
      ([videoId, avgViewPercent]) => ({ videoId, avgViewPercent })
    );

    if (retentionResult.status === "rejected") {
      const status = (retentionResult.reason as { status?: number })?.status;
      if (status === 403) {
        return NextResponse.json(
          { forbidden: true, error: "このチャンネルのアナリティクスにアクセスする権限がありません" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ analytics, channelCtr });
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
