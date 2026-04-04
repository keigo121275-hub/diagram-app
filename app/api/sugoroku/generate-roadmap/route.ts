import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(request: NextRequest) {
  // 認証チェック（admin のみ）
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: member } = await supabase
    .from("members")
    .select("role")
    .eq("id", user.id)
    .single();
  if (member?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { inputText, duration } = await request.json();

  if (!inputText || inputText.length < 50) {
    return NextResponse.json(
      { error: "テキストは50文字以上入力してください" },
      { status: 400 }
    );
  }

  const prompt = `以下のテキストから育成ロードマップのタスクリストをJSON形式で生成してください。

【制約】
- 大タスク（large）は5〜8個にまとめる。これがすごろくの「マス」になる
- 各大タスクの中に、中タスク（medium）を2〜4個入れる
- 必要であれば中タスクの中に小タスク（small）を1〜3個入れる
- 並び順は学習・作業の自然な順序にする
- 各タスクにtitle（日本語）とlevelを付ける
- 期間の目安: ${duration}

【出力JSON形式（このJSONのみ返す。説明文は不要）】
{
  "roadmap_title": "ロードマップタイトル",
  "tasks": [
    {
      "title": "大タスク名",
      "level": "large",
      "order": 1,
      "children": [
        {
          "title": "中タスク名",
          "level": "medium",
          "order": 1,
          "children": [
            { "title": "小タスク名", "level": "small", "order": 1 }
          ]
        }
      ]
    }
  ]
}

【入力テキスト】
${inputText}`;

  const message = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const rawText =
    message.content[0].type === "text" ? message.content[0].text : "";

  // JSON 部分を抽出
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json(
      { error: "Claude からの応答を解析できませんでした" },
      { status: 500 }
    );
  }

  const result = JSON.parse(jsonMatch[0]);

  return NextResponse.json(result);
}
