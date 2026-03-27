/**
 * YouTube Reporting API ジョブ管理
 *
 * GET  /api/youtube/reporting/setup?channelId=...
 *   - 現在のジョブ一覧を返す（setupページ用）
 *
 * POST /api/youtube/reporting/setup
 *   - { channelId } を受け取り、traffic_source レポートのジョブを作成する
 *   - 対象レポート: channel_traffic_source_a2（インプレッション・CTR含む）
 *   - ジョブ ID を Redis に保存する
 *
 * 注意: ジョブ作成後、最初のレポートが届くまで 24〜48 時間かかる
 */
import { NextRequest, NextResponse } from "next/server";
import { getYoutubeReportingClient } from "@/lib/getYoutubeReportingClient";
import redis from "@/lib/redis";

/** Redis に保存するジョブIDのキー */
function jobKey(channelId: string) {
  return `rpt_job:${channelId}`;
}

// ---------------------------------------------------------------------------
// GET: 現在のジョブ一覧 + 利用可能なレポート種別を返す
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const channelId = searchParams.get("channelId");

  if (!channelId) {
    return NextResponse.json({ error: "channelId が必要です" }, { status: 400 });
  }

  const result = await getYoutubeReportingClient(channelId);
  if (!result) {
    return NextResponse.json({ error: "チャンネルが未接続です" }, { status: 401 });
  }
  const { client } = result;

  try {
    const [jobsRes, typesRes] = await Promise.all([
      client.jobs.list({}),
      client.reportTypes.list({}),
    ]);

    const jobs = (jobsRes.data.jobs ?? []).map((j) => ({
      id: j.id,
      reportTypeId: j.reportTypeId,
      name: j.name,
      createTime: j.createTime,
    }));

    const reportTypes = (typesRes.data.reportTypes ?? []).map((t) => ({
      id: t.id,
      name: t.name,
    }));

    const savedJobId = await redis.get(jobKey(channelId));

    return NextResponse.json({ jobs, savedJobId, reportTypes });
  } catch (err) {
    console.error("[Reporting/setup GET]", err);
    return NextResponse.json(
      { error: "ジョブ一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST: ジョブを作成して Redis に保存
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const channelId: string | undefined = body.channelId;

  if (!channelId) {
    return NextResponse.json({ error: "channelId が必要です" }, { status: 400 });
  }

  const result = await getYoutubeReportingClient(channelId);
  if (!result) {
    return NextResponse.json({ error: "チャンネルが未接続です" }, { status: 401 });
  }
  const { client } = result;

  // 既存ジョブを確認して重複作成を防ぐ
  try {
    const existingRes = await client.jobs.list({});
    const existingJob = (existingRes.data.jobs ?? []).find(
      (j) => j.reportTypeId === "channel_reach_basic_a1"
    );

    if (existingJob?.id) {
      // 既存ジョブを Redis に保存（上書き）
      await redis.set(jobKey(channelId), existingJob.id);
      return NextResponse.json({
        status: "already_exists",
        jobId: existingJob.id,
        reportTypeId: existingJob.reportTypeId,
        message: "既存のジョブを再利用します",
      });
    }
  } catch (err) {
    console.error("[Reporting/setup POST] 既存ジョブ確認エラー:", err);
  }

  // 新規ジョブ作成
  try {
    const res = await client.jobs.create({
      requestBody: {
        reportTypeId: "channel_reach_basic_a1",
        name: "yt-analytics-tool-ctr",
      },
    });

    const jobId = res.data.id;
    if (!jobId) {
      return NextResponse.json({ error: "ジョブIDが取得できませんでした" }, { status: 500 });
    }

    // Redis に保存（TTL なし）
    await redis.set(jobKey(channelId), jobId);

    return NextResponse.json({
      status: "created",
      jobId,
      reportTypeId: res.data.reportTypeId,
      message: "ジョブを作成しました。最初のレポートは 24〜48 時間後に届きます。",
    });
  } catch (err) {
    console.error("[Reporting/setup POST] ジョブ作成エラー:", err);
    return NextResponse.json(
      { error: "ジョブの作成に失敗しました" },
      { status: 500 }
    );
  }
}
