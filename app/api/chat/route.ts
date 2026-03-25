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
  const base = `
あなたは資料作成を助けるアシスタントです。自然で丁寧な日本語を使ってください。

## 情報収集の原則
- ユーザーが貼り付けた内容を最初に全部読み、すでに書かれている情報は絶対に再質問しない
- 1回のターンで聞く質問は必ず1問だけ。複数まとめない
- 質問は「〇〇について教えてください」ではなく「〇〇はどうでしたか？」のように具体的に問う
- 最大3〜4問の質問で必要な情報を揃える。それ以上は続けない

## 深掘りの判断基準
- 深掘りしてよいのは次の2つの場合のみ：
  1. 「なぜ」への答えが「結果をそのまま言い直しただけ」のとき（例：「売上が上がった理由は？」→「売上が伸びたからです」）
  2. 「どうやって」「何を」への答えが、図に書けるほど具体的でないとき（例：「頑張った」「工夫した」だけ）
- 答えに数値・施策名・固有名詞・手順が含まれていれば深掘り不要

## [COMPLETE] を送るタイミング
- 必須項目がすべて把握できたら、その返答文の末尾の行に [COMPLETE] とだけ書く
- 情報の一部が曖昧でも、図を作るのに十分なら [COMPLETE] でよい
- ユーザーが「もういい」「これで」と言ったら即座に [COMPLETE]
  `.trim();

  const typeGuide: Record<DiagramType, string> = {
    report: `
## 報告型：必須項目と深掘り基準

必須項目（この順番で1つずつ確認する）：
1. 結論・結果 ── 数値や達成率があれば必ず含める
2. なぜその結果になったか ── 行動・施策・外部要因など。「頑張ったから」「運が良かった」は深掘りする
3. どうやって達成したか ── 具体的な施策名・行動・手順。「工夫した」は深掘りする
4. 次のアクション ── 何を・いつまでに・誰が、が分かればOK

深掘り不要の例：
- 「キャンペーンを3回実施して新規獲得率が15%向上した」→ 具体的なのでそのまま使う
- 「SNSで毎日投稿した結果フォロワーが2倍になった」→ 十分

${reportTone === "good" ? "トーン：成果・達成を前向きに強調する言葉を使う。" : "トーン：課題・改善を冷静に整理する言葉を使う。"}
    `.trim(),

    mindmap: `
## マインドマップ型：必須項目と深掘り基準

必須項目（この順番で1つずつ確認する）：
1. 中心テーマ ── 1〜2文で表せる軸。曖昧な場合のみ確認する
2. 広げたいアイデア・観点 ── 3〜6個程度のブランチになる内容。すでに列挙されていれば聞かない
3. 特に強調したい項目 ── 「これだけは外せない」という1〜2個。なければそのままでよい

深掘り不要の例：
- テーマとアイデアが貼り付けた文章から読み取れる場合はすぐ [COMPLETE]
    `.trim(),

    "step-flow": `
## STEP・フロー型：必須項目と深掘り基準

必須項目（この順番で1つずつ確認する）：
1. 全体のゴール ── 「このフローを通じて何を達成するか」。1文で表せればOK
2. ステップの数と順番 ── 3〜7ステップが理想。すでに書かれていれば確認不要
3. 各ステップの補足・注意点 ── 「〇〇に気をつける」など。なければそのままでよい

深掘り不要の例：
- ステップ名と順番が貼り付けた文章に書いてある場合はすぐ [COMPLETE]
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
