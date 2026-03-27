/**
 * YouTube Reporting API CSVダウンロード Cron
 *
 * GET /api/cron/reporting
 *   - vercel.json の crons で毎日 1:00 UTC（10:00 JST）に自動実行
 *   - 登録済み全チャンネルの最新レポートをダウンロードして Redis に保存する
 *
 * 保存する Redis キー:
 *   rpt_ctr:{channelId}:{videoId}
 *     → { impressions: number, ctr: number, date: string }
 *     TTL: 30日
 *
 * CSVフォーマット（channel_traffic_source_a2）:
 *   date,channel_id,video_id,traffic_source_type,...,impressions,impressions_click_through_rate,...
 *   各 video_id について複数のトラフィックソース行が存在するため、加重平均で集計する
 */
import { NextRequest, NextResponse } from "next/server";
import { getAllChannelTokens } from "@/lib/channelTokenStore";
import { getYoutubeReportingClient } from "@/lib/getYoutubeReportingClient";
import redis from "@/lib/redis";

export const dynamic = "force-dynamic";

type CtrRecord = {
  impressions: number;
  ctr: number;
  date: string;
};

function ctrKey(channelId: string, videoId: string) {
  return `rpt_ctr:${channelId}:${videoId}`;
}

function jobKey(channelId: string) {
  return `rpt_job:${channelId}`;
}

function processedKey(jobId: string, reportId: string) {
  return `rpt_done:${jobId}:${reportId}`;
}

/**
 * CSV テキストを解析して { videoId → CtrRecord } のマップを返す。
 * 複数トラフィックソース行を加重平均で集計する。
 */
function parseCsv(csv: string, reportDate: string): Map<string, CtrRecord> {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return new Map();

  const headers = lines[0].split(",").map((h) => h.trim());
  const videoIdx = headers.indexOf("video_id");
  const impIdx = headers.indexOf("impressions");
  const ctrIdx = headers.indexOf("impressions_click_through_rate");

  if (videoIdx < 0 || impIdx < 0 || ctrIdx < 0) {
    console.warn("[Reporting/cron] 必要な列が見つかりません:", headers.join(", "));
    return new Map();
  }

  const accumulator = new Map<string, { totalImp: number; weightedCtrSum: number }>();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const videoId = cols[videoIdx]?.trim();
    if (!videoId) continue;

    const imp = parseFloat(cols[impIdx] ?? "0") || 0;
    const ctr = parseFloat(cols[ctrIdx] ?? "0") || 0;

    const acc = accumulator.get(videoId) ?? { totalImp: 0, weightedCtrSum: 0 };
    acc.totalImp += imp;
    acc.weightedCtrSum += imp * ctr;
    accumulator.set(videoId, acc);
  }

  const result = new Map<string, CtrRecord>();
  for (const [videoId, acc] of accumulator.entries()) {
    if (acc.totalImp === 0) continue;
    result.set(videoId, {
      impressions: Math.round(acc.totalImp),
      ctr: acc.weightedCtrSum / acc.totalImp,
      date: reportDate,
    });
  }

  return result;
}

/**
 * 1チャンネル分の最新レポートをダウンロードして Redis に保存する
 */
async function processChannel(
  channelId: string
): Promise<{ updated: number; skipped: string }> {
  const result = await getYoutubeReportingClient(channelId);
  if (!result) return { updated: 0, skipped: "クライアント取得失敗" };

  const { client, oauth2Client } = result;

  const jobId = await redis.get(jobKey(channelId));
  if (!jobId) {
    return {
      updated: 0,
      skipped: "ジョブ未設定（POST /api/youtube/reporting/setup を先に実行）",
    };
  }

  // 最新レポートを取得
  const reportsRes = await client.jobs.reports.list({ jobId });
  const reports = reportsRes.data.reports ?? [];
  if (!reports.length) {
    return {
      updated: 0,
      skipped: "レポートなし（ジョブ作成後 24〜48 時間待ち）",
    };
  }

  const latest = reports
    .sort((a, b) => {
      const ta = new Date(a.createTime ?? 0).getTime();
      const tb = new Date(b.createTime ?? 0).getTime();
      return tb - ta;
    })
    .at(0);

  if (!latest?.id || !latest.downloadUrl) {
    return { updated: 0, skipped: "ダウンロードURL取得失敗" };
  }

  // 処理済みチェック
  const doneKey = processedKey(jobId, latest.id);
  const alreadyDone = await redis.get(doneKey);
  if (alreadyDone) {
    return { updated: 0, skipped: `レポート ${latest.id} は処理済み` };
  }

  // OAuth2 アクセストークンを取得して CSV を fetch
  const { token } = await oauth2Client.getAccessToken();
  if (!token) return { updated: 0, skipped: "アクセストークン取得失敗" };

  const csvRes = await fetch(`${latest.downloadUrl}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!csvRes.ok) {
    return {
      updated: 0,
      skipped: `CSV ダウンロード失敗: ${csvRes.status} ${csvRes.statusText}`,
    };
  }

  const csvText = await csvRes.text();
  if (!csvText) return { updated: 0, skipped: "CSV が空でした" };

  const reportDate =
    (latest.startTime ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10);

  const ctrMap = parseCsv(csvText, reportDate);
  if (!ctrMap.size) {
    return { updated: 0, skipped: "CSV のパースに失敗（列が見つからない）" };
  }

  // Redis に保存（TTL 30日）
  const pipeline = redis.pipeline();
  for (const [videoId, record] of ctrMap.entries()) {
    pipeline.set(
      ctrKey(channelId, videoId),
      JSON.stringify(record),
      "EX",
      30 * 86400
    );
  }
  await pipeline.exec();

  // 処理済みマーク（7日後に自動削除）
  await redis.set(doneKey, "1", "EX", 7 * 86400);

  return { updated: ctrMap.size, skipped: "" };
}

// ---------------------------------------------------------------------------
// GET: Vercel Cron から呼ばれるエンドポイント
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const channels = await getAllChannelTokens();
  if (!channels.length) {
    return NextResponse.json({ message: "接続済みチャンネルがありません" });
  }

  const results: {
    channelId: string;
    updated: number;
    skipped: string;
    error?: string;
  }[] = [];

  for (const ch of channels) {
    try {
      const { updated, skipped } = await processChannel(ch.channelId);
      results.push({ channelId: ch.channelId, updated, skipped });
      console.log(
        `[Reporting/cron] channelId=${ch.channelId} updated=${updated} skipped=${skipped}`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      results.push({ channelId: ch.channelId, updated: 0, skipped: "", error: msg });
      console.error(`[Reporting/cron] channelId=${ch.channelId}`, msg);
    }
  }

  return NextResponse.json({ results });
}
