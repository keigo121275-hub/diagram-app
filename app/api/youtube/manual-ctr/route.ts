/**
 * 手動入力 CTR・インプレッション数の保存・取得
 *
 * POST /api/youtube/manual-ctr
 *   { channelId, videoId, ctr, impressions }
 *   → Redis に manual_ctr:{channelId}:{videoId} で保存（TTL なし）
 *
 * GET /api/youtube/manual-ctr?channelId=...&videoIds=id1,id2,...
 *   → 各動画の手動入力データを返す
 *
 * DELETE /api/youtube/manual-ctr
 *   { channelId, videoId }
 *   → 手動入力データを削除（自動データに戻す）
 */
import { NextRequest, NextResponse } from "next/server";
import redis from "@/lib/redis";

type ManualCtrRecord = {
  ctr: number | null;         // 0〜100 の % 値で保存（例: 5.3）
  impressions: number | null;
  updatedAt: string;
};

function manualKey(channelId: string, videoId: string) {
  return `manual_ctr:${channelId}:${videoId}`;
}

// ---------------------------------------------------------------------------
// GET: 複数動画の手動入力データを一括返却
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const channelId = searchParams.get("channelId");
  const videoIdsParam = searchParams.get("videoIds");

  if (!channelId || !videoIdsParam) {
    return NextResponse.json({ error: "channelId と videoIds が必要です" }, { status: 400 });
  }

  const videoIds = videoIdsParam.split(",").filter(Boolean);

  const results = await Promise.all(
    videoIds.map(async (videoId) => {
      const raw = await redis.get(manualKey(channelId, videoId));
      if (!raw) return { videoId, ctr: null, impressions: null, updatedAt: null };
      const record = JSON.parse(raw) as ManualCtrRecord;
      return { videoId, ...record };
    })
  );

  return NextResponse.json({ manual: results });
}

// ---------------------------------------------------------------------------
// POST: 手動入力データを保存
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { channelId, videoId, ctr, impressions } = body as {
    channelId?: string;
    videoId?: string;
    ctr?: number | null;
    impressions?: number | null;
  };

  if (!channelId || !videoId) {
    return NextResponse.json({ error: "channelId と videoId が必要です" }, { status: 400 });
  }

  const record: ManualCtrRecord = {
    ctr: ctr ?? null,
    impressions: impressions ?? null,
    updatedAt: new Date().toISOString(),
  };

  await redis.set(manualKey(channelId, videoId), JSON.stringify(record));

  return NextResponse.json({ ok: true, videoId, record });
}

// ---------------------------------------------------------------------------
// DELETE: 手動入力データを削除
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { channelId, videoId } = body as { channelId?: string; videoId?: string };

  if (!channelId || !videoId) {
    return NextResponse.json({ error: "channelId と videoId が必要です" }, { status: 400 });
  }

  await redis.del(manualKey(channelId, videoId));
  return NextResponse.json({ ok: true });
}
