// 【このファイルの役割】
// ユーザーの会話をClaudeに送り、返事をJSON形式で返す「窓口」
// ブラウザからは直接Claudeに触れないので、このファイルが仲介役になる

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

// Claudeに渡す「役割の説明書」を作る関数
// diagramType（図の種類）によって、Claudeが何を質問すべきか変わる
function buildSystemPrompt(
  diagramType: string,
  reportTone?: string
): string {
  const base = `あなたは会話を図解するアシスタントです。自然で丁寧な日本語を使ってください。

## 絶対ルール
- まず貼り付けられた内容をしっかり読み、すでに書かれている情報は絶対に聞き直さない
- 不足している情報だけを、1つずつ質問する
- 「なぜ」の答えが「結果の言い直し」になっている場合のみ深掘りする
- 「どんな」の具体が本当に抜けている場合のみ深掘りする
- 十分な情報が揃ったと判断したら、最後の行に [COMPLETE] とだけ書く

## 回答形式
普通の日本語で答えてください。JSONは使わない。
情報が揃ったときだけ、メッセージの最後の行に [COMPLETE] と書く。それ以外のときは書かない。`;

  if (diagramType === "report") {
    const toneNote =
      reportTone === "good"
        ? "良い報告（成果・達成）のトーンで進める。"
        : "普通/改善報告のトーンで進める。";

    return (
      base +
      `

## 報告型の必須項目（この順番で1つずつ確認する）
1. 結論・結果（数値があれば含む）
2. なぜその結果になったか（表面的な答えは深掘りする）
3. どうやって達成したか（具体的な施策）
4. 次のアクション

${toneNote}

全項目が揃い、「なぜ」「どんな」の具体まで確認できたら isComplete: true にする。`
    );
  }

  if (diagramType === "mindmap") {
    return (
      base +
      `

## マインドマップ型の必須項目（この順番で1つずつ確認する）
1. 中心テーマ
2. 広げたいアイデア・観点
3. 特に強調したい項目

全項目が揃ったら isComplete: true にする。`
    );
  }

  if (diagramType === "step-flow") {
    return (
      base +
      `

## STEP・フロー型の必須項目（この順番で1つずつ確認する）
1. 全体のゴール
2. ステップの数と順番
3. 各ステップの補足・注意点

全項目が揃ったら isComplete: true にする。`
    );
  }

  return base;
}

export async function POST(req: NextRequest) {
  try {
    // ブラウザから送られてきたデータを取り出す
    const { messages, diagramType, reportTone } = await req.json();

    // Claudeクライアントを作る（APIキーで認証する）
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Claudeに会話を送る
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: buildSystemPrompt(diagramType, reportTone),
      messages: messages, // これまでの会話の履歴をすべて渡す
    });

    // Claudeの返事を取り出す
    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    // [COMPLETE] が含まれているか確認して、含まれていれば取り除いてフラグを立てる
    const text = content.text.trim();
    const isComplete = text.includes("[COMPLETE]");
    const message = text.replace("[COMPLETE]", "").trim();

    return NextResponse.json({ message, isComplete });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { message: "エラーが発生しました。もう一度お試しください。", isComplete: false },
      { status: 500 }
    );
  }
}
