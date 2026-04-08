import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { week_start_date } = await request.json();
  if (!week_start_date) {
    return NextResponse.json(
      { error: "week_start_date は必須です" },
      { status: 400 }
    );
  }

  // 週末（日曜）を計算
  const weekStart = new Date(`${week_start_date}T00:00:00`);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  // その週の日報を取得（本人分のみ）
  const { data: reports, error } = await supabase
    .from("daily_reports")
    .select("body, date, created_at")
    .eq("member_id", user.id)
    .gte("date", week_start_date)
    .lte("date", weekEndStr)
    .order("date", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "日報の取得に失敗しました" },
      { status: 500 }
    );
  }

  if (!reports || reports.length === 0) {
    return NextResponse.json(
      { error: "この週の日報が見つかりません。日報を投稿してから週報を生成してください。" },
      { status: 400 }
    );
  }

  const DAYS_JA = ["日", "月", "火", "水", "木", "金", "土"];
  const dailySummary = reports
    .map((r) => {
      const d = new Date(`${r.date}T00:00:00`);
      const label = `${d.getMonth() + 1}/${d.getDate()}(${DAYS_JA[d.getDay()]})`;
      return `【${label}】\n${r.body}`;
    })
    .join("\n\n");

  const prompt = `以下は今週（${week_start_date} 〜 ${weekEndStr}）の日報です。
日報の内容をもとに、週報テンプレートの各フィールドを日本語で記入してください。

【日報一覧（${reports.length}件）】
${dailySummary}

【週報テンプレート（以下のJSON形式のみ返す。説明文・コードブロック不要）】
{
  "main_events": "今週の主なできごと・取り組んだことを簡潔に（100〜200字）",
  "actions": "目標達成に向けて今週行った具体的なアクション（100〜200字）",
  "last_week_results": "先週設定した目標・行動に対する結果と振り返り（100〜200字）",
  "what_went_well": "うまくいったこと・感謝を伝えたいことを記載（100〜200字）",
  "improvements": "改善できる点・次週に向けての課題（100〜200字）",
  "next_actions": "この週報を踏まえた来週やること（100〜200字）"
}`;

  let message;
  try {
    message = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Claude API エラー: " + msg },
      { status: 500 }
    );
  }

  const rawText =
    message.content[0].type === "text" ? message.content[0].text : "";

  // JSON 抽出
  const startIdx = rawText.indexOf("{");
  let jsonStr: string | null = null;
  if (startIdx !== -1) {
    let depth = 0;
    let endIdx = -1;
    for (let i = startIdx; i < rawText.length; i++) {
      if (rawText[i] === "{") depth++;
      else if (rawText[i] === "}") {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
    if (endIdx !== -1) jsonStr = rawText.slice(startIdx, endIdx + 1);
  }

  if (!jsonStr) {
    return NextResponse.json(
      { error: "Claude からの応答を解析できませんでした" },
      { status: 500 }
    );
  }

  let result;
  try {
    result = JSON.parse(jsonStr);
  } catch {
    return NextResponse.json(
      { error: "JSON の解析に失敗しました" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ...result,
    daily_count: reports.length,
    week_start_date,
    week_end_date: weekEndStr,
  });
}
