/**
 * /api/chat
 *
 * 役割：ブラウザからの会話メッセージを受け取り、Claude AIに転送して返事を返す。
 *
 * 流れ：
 *   ブラウザ → このファイル → Claude API → このファイル → ブラウザ
 *
 * なぜサーバー側に置くか：
 *   APIキーをブラウザに置くと誰でも見られてしまう。
 *   サーバー（このファイル）を仲介役にすることでAPIキーを隠す。
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

// ─────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────

type DiagramType = "mindmap" | "step-flow" | "report";
type ReportTone = "good" | "normal";

// ─────────────────────────────────────────────
// システムプロンプト生成
// Claude に「どう動くか」を指示する文章を作る関数
// ─────────────────────────────────────────────

function buildSystemPrompt(diagramType: DiagramType, reportTone?: ReportTone): string {
  // 全パターン共通のルール
  const base = `
あなたは会話を図解するアシスタントです。自然で丁寧な日本語を使ってください。

## ルール
- まず貼り付けられた内容をしっかり読む。すでに書かれている情報は絶対に聞き直さない
- 不足している情報だけを、1問ずつ質問する（複数まとめない）
- 「なぜ」の答えが「結果の言い直し」になっている場合のみ深掘りする
- 「どんな」の具体が本当に抜けている場合のみ深掘りする
- 情報が十分に揃ったと判断したら、メッセージの最後の行に [COMPLETE] とだけ書く
  `.trim();

  // 図の種類ごとに「何を確認すべきか」を追加する
  const typeGuide: Record<DiagramType, string> = {
    report: `
## 報告型：確認する項目（この順番で1つずつ）
1. 結論・結果（数値があれば含む）
2. なぜその結果になったか（表面的な答えは深掘りする）
3. どうやって達成したか（具体的な施策）
4. 次のアクション

${reportTone === "good" ? "良い報告（成果・達成）のトーンで進める。" : "普通/改善報告のトーンで進める。"}
    `.trim(),

    mindmap: `
## マインドマップ型：確認する項目（この順番で1つずつ）
1. 中心テーマ
2. 広げたいアイデア・観点
3. 特に強調したい項目
    `.trim(),

    "step-flow": `
## STEP・フロー型：確認する項目（この順番で1つずつ）
1. 全体のゴール
2. ステップの数と順番
3. 各ステップの補足・注意点
    `.trim(),
  };

  return `${base}\n\n${typeGuide[diagramType]}`;
}

// ─────────────────────────────────────────────
// POSTリクエストの処理
// ブラウザから「POST /api/chat」が来たときに実行される
// ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ブラウザから送られてきたデータを取り出す
    const { messages, diagramType, reportTone } = await req.json();

    // Anthropic（Claude）クライアントを初期化
    // APIキーは .env.local から自動で読み込まれる
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Claude に会話を送って返事をもらう
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",       // 使用するモデル（最新のSonnet）
      max_tokens: 1024,                  // 返答の最大文字数（トークン数）
      system: buildSystemPrompt(diagramType, reportTone), // 役割の指示
      messages,                          // これまでの会話履歴をすべて渡す
    });

    // Claudeのテキスト返答を取り出す
    const text = (response.content[0] as { type: string; text: string }).text.trim();

    // [COMPLETE] が含まれているか確認する
    // 含まれていれば「情報が揃った」サインなので isComplete を true にする
    const isComplete = text.includes("[COMPLETE]");

    // [COMPLETE] はUIに表示しないので取り除く
    const message = text.replace("[COMPLETE]", "").trim();

    // ブラウザに返す
    return NextResponse.json({ message, isComplete });

  } catch (error) {
    console.error("[/api/chat] エラー:", error);
    return NextResponse.json(
      { message: "エラーが発生しました。もう一度お試しください。", isComplete: false },
      { status: 500 }
    );
  }
}
