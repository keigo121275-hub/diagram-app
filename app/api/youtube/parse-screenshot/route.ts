/**
 * YouTube Studio スクリーンショットから
 * インプレッション・CTR・視聴回数などを Claude Vision で解析して返す
 *
 * POST /api/youtube/parse-screenshot
 *   Content-Type: multipart/form-data
 *   Fields:
 *     - image: File (JPEG / PNG / WebP)
 *     - channelId: string
 *     - videoId: string
 *
 *   Returns:
 *     { ok: true, extracted: { totalImpressions, totalCtr, totalViews, avgViewPercent, sources: [...] } }
 */
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import redis from "@/lib/redis";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type TrafficSource = {
  name: string;
  impressions: number | null;
  ctr: number | null;
  views: number | null;
  avgViewPercent: number | null;
};

type Extracted = {
  totalImpressions: number | null;
  totalCtr: number | null;
  totalViews: number | null;
  avgViewPercent: number | null;
  sources: TrafficSource[];
};

const PROMPT = `
この画像は YouTube Studio のアナリティクス画面です。
画面に表示されているトラフィックソース別のデータを読み取り、JSON で返してください。

抽出するデータ:
- 合計行: totalImpressions（インプレッション数）、totalCtr（クリック率%）、totalViews（視聴回数）、avgViewPercent（平均視聴率%）
- 各トラフィックソース行: name, impressions, ctr（%）, views, avgViewPercent（%）

注意:
- 「–」や空欄は null とする
- クリック率は % の数値のみ返す（例: "5.3%" → 5.3）
- 平均視聴率は % の数値のみ（例: "38.5%" → 38.5）
- インプレッション数・視聴回数はカンマなしの整数で返す
- 必ず JSON のみ返す。説明文は不要

返す JSON の形式:
{
  "totalImpressions": 52441,
  "totalCtr": 5.8,
  "totalViews": 4174,
  "avgViewPercent": 38.5,
  "sources": [
    { "name": "ブラウジング機能", "impressions": 39852, "ctr": 5.9, "views": 2937, "avgViewPercent": 35.0 },
    { "name": "関連動画", "impressions": 11261, "ctr": 5.0, "views": 666, "avgViewPercent": 47.6 }
  ]
}
`.trim();

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "フォームデータの解析に失敗しました" }, { status: 400 });
  }

  const imageFile = formData.get("image") as File | null;
  const channelId = formData.get("channelId") as string | null;
  const videoId = formData.get("videoId") as string | null;

  if (!imageFile || !channelId || !videoId) {
    return NextResponse.json(
      { error: "image, channelId, videoId が必要です" },
      { status: 400 }
    );
  }

  // ファイルを base64 に変換
  const arrayBuffer = await imageFile.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mediaType = (imageFile.type || "image/png") as "image/jpeg" | "image/png" | "image/webp" | "image/gif";

  // Claude Vision で解析
  let extracted: Extracted;
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: "text",
              text: PROMPT,
            },
          ],
        },
      ],
    });

    const text = (response.content[0] as { type: string; text: string }).text.trim();
    // JSON 部分だけ取り出す（```json ... ``` のマークダウンに対応）
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AIの返答からJSONを取り出せませんでした", raw: text }, { status: 422 });
    }
    extracted = JSON.parse(jsonMatch[0]) as Extracted;
  } catch (err) {
    console.error("[parse-screenshot] Claude error:", err);
    return NextResponse.json({ error: "AI解析に失敗しました" }, { status: 500 });
  }

  // manual_ctr に保存（ctr は % → 小数に変換しない、manual-ctr は % で保存する設計）
  const manualRecord = {
    ctr: extracted.totalCtr,
    impressions: extracted.totalImpressions,
    avgViewPercent: extracted.avgViewPercent,
    sources: extracted.sources,
    updatedAt: new Date().toISOString(),
    source: "screenshot",
  };
  await redis.set(
    `manual_ctr:${channelId}:${videoId}`,
    JSON.stringify(manualRecord)
  );

  return NextResponse.json({ ok: true, extracted, saved: true });
}
