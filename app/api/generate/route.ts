/**
 * /api/generate
 *
 * 役割：これまでの会話内容をもとに、図解HTMLページを生成して返す。
 *
 * 流れ：
 *   チャットが完了（[COMPLETE]）
 *     → ユーザーが「資料を生成する」ボタンを押す
 *     → ブラウザがこのAPIを呼ぶ
 *     → Claudeが会話を読んでHTMLを生成
 *     → ブラウザのiframeに表示
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

// ─────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────

type DiagramType = "mindmap" | "step-flow" | "report";
type ReportTone = "good" | "normal";

// ─────────────────────────────────────────────
// HTML生成用のシステムプロンプト
// 図の種類ごとにデザインルールと構成を指示する
// ─────────────────────────────────────────────

function buildGenerationPrompt(diagramType: DiagramType, reportTone?: ReportTone): string {
  // 全パターン共通のデザインルール
  const commonDesign = `
## 共通デザインルール
- 背景：白（#ffffff）
- フォント：'Hiragino Sans', 'BIZ UDPGothic', sans-serif
- コンテンツ幅：max-width: 860px、中央寄せ
- カード要素：border-radius: 12px、box-shadow: 0 2px 8px rgba(0,0,0,0.08)
- 全テキストに word-break: keep-all を適用（日本語が変な位置で折り返されないように）
- スマホ対応（レスポンシブ）必須：max-width: 600px のメディアクエリを入れる
- セクション間の余白：padding 40px以上
- ノードのラベルは短く・体言止め
- 補足テキストは1〜2文、核心のみ
  `.trim();

  // 報告型：カードレイアウト
  if (diagramType === "report") {
    const isGood = reportTone === "good";
    const accent = isGood ? "#f97316" : "#2563eb";   // 良い報告=オレンジ、改善=ブルー
    const bg = isGood ? "#fff7ed" : "#eff6ff";
    const textColor = isGood ? "#9a3412" : "#1e3a8a";

    return `
会話の内容をもとに、報告型のHTMLページを生成してください。

${commonDesign}

## 報告型の構成（この順番で）
1. ページヘッダー（タイトル・日付）
2. 結論・結果セクション
   - 大きく目立つ数値・結論（font-size: 64px以上）
   - アクセントカラー: ${accent}、背景: ${bg}
   - 前期比較があればバッジで表示
3. 数値グラフセクション（月次推移など）
   - シンプルな横棒グラフ（CSSのみ、ライブラリ不要）
4. なぜ・どうやってセクション（カード形式）
   - 各カードにアイコン・タイトル・説明
   - 「なぜ」はオレンジの左ボーダー付きで表示：
     <span style="display:block;margin-top:8px;border-left:3px solid ${accent};padding:6px 12px;background:${bg};font-size:13px;color:${textColor};">なぜ：[理由]</span>
5. 次のアクションセクション
   - 番号付きリスト（丸数字バッジ）
   - 背景: ${bg}

HTMLのコードのみを返してください。説明文は不要です。
    `.trim();
  }

  // マインドマップ型：Mermaid.js使用
  if (diagramType === "mindmap") {
    return `
会話の内容をもとに、マインドマップ型のHTMLページを生成してください。

${commonDesign}

## マインドマップ型の構成
- Mermaid.js（CDN: https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js）を使って描画
- mindmap記法を使う
- ノードのラベルは10文字以内
- 図の下に各項目の補足テキストセクションを設ける（dl/dt/dd形式）

HTMLのコードのみを返してください。説明文は不要です。
    `.trim();
  }

  // STEP・フロー型：Mermaid.js使用
  if (diagramType === "step-flow") {
    return `
会話の内容をもとに、STEP・フロー型のHTMLページを生成してください。

${commonDesign}

## STEP・フロー型の構成
- Mermaid.js（CDN: https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js）を使って描画
- flowchart TD記法を使う
- ノードのラベルは短く
- 図の下に各STEPの補足テキストをカード形式で並べる

HTMLのコードのみを返してください。説明文は不要です。
    `.trim();
  }

  return `会話の内容をもとにHTMLページを生成してください。${commonDesign}`;
}

// ─────────────────────────────────────────────
// POSTリクエストの処理
// ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { messages, diagramType, reportTone } = await req.json();

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // 会話履歴の最後に「HTMLを作ってください」という指示を追加する
    const messagesWithInstruction = [
      ...messages,
      {
        role: "user" as const,
        content: "上記の会話内容をもとに、指定のデザインルールに従ってHTMLを生成してください。HTMLのコードのみを返してください。",
      },
    ];

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8096,  // HTMLは長くなるので多めに確保
      system: buildGenerationPrompt(diagramType, reportTone),
      messages: messagesWithInstruction,
    });

    const rawText = (response.content[0] as { type: string; text: string }).text;

    // ClaudeがHTMLをコードブロック（```html ... ```）で包んで返す場合があるので取り除く
    const html = rawText
      .replace(/^```html\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    return NextResponse.json({ html });

  } catch (error) {
    console.error("[/api/generate] エラー:", error);
    return NextResponse.json(
      { error: "HTMLの生成に失敗しました。もう一度お試しください。" },
      { status: 500 }
    );
  }
}
