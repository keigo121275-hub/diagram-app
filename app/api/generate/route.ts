// 【このファイルの役割】
// 会話の内容をClaudeに渡して、HTMLを生成してもらう
// チャットが完了したあとに呼ばれる

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { messages, diagramType, reportTone } = await req.json();

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // 会話の内容をまとめてHTMLを作るよう指示する
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8096,
      system: buildGenerationPrompt(diagramType, reportTone),
      messages: [
        ...messages,
        {
          role: "user",
          content:
            "上記の会話内容をもとに、指定のデザインルールに従ってHTMLを生成してください。HTMLのコードのみを返してください。",
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    // ClaudeがHTMLを返してくる（コードブロックがある場合は取り除く）
    const html = content.text
      .replace(/^```html\n?/, "")
      .replace(/\n?```$/, "")
      .trim();

    return NextResponse.json({ html });
  } catch (error) {
    console.error("Generate API error:", error);
    return NextResponse.json(
      { error: "HTMLの生成に失敗しました。" },
      { status: 500 }
    );
  }
}

function buildGenerationPrompt(diagramType: string, reportTone?: string): string {
  const commonDesign = `
## 共通デザインルール
- 背景：白（#ffffff）
- フォント：'Hiragino Sans', 'BIZ UDPGothic', sans-serif
- コンテンツ幅：max-width: 860px、中央寄せ
- カード要素：border-radius: 12px、box-shadow: 0 2px 8px rgba(0,0,0,0.08)
- 全テキストに word-break: keep-all を適用
- スマホ対応（レスポンシブ）必須
- セクション間の余白：padding 40px以上
- ノードのラベルは10文字以内、体言止め
- 補足テキストは1〜2文、核心のみ`;

  if (diagramType === "report") {
    const isGood = reportTone === "good";
    const accent = isGood ? "#f97316" : "#2563eb";
    const bg = isGood ? "#fff7ed" : "#eff6ff";
    const textColor = isGood ? "#9a3412" : "#1e3a8a";

    return `会話の内容をもとに、報告型のHTMLページを生成してください。
${commonDesign}

## 報告型の構成（この順番で）
1. 結論・結果セクション（大きく・目立つ、アクセントカラー: ${accent}、背景: ${bg}）
2. なぜ・どうやってセクション（カード形式、「なぜ」はオレンジの左ボーダー付きで表示）
3. 次のアクションセクション（番号付きリスト、背景: ${bg}）

「なぜ」の表示スタイル：
<span style="display:block; margin-top:8px; border-left:3px solid ${accent}; padding:6px 12px; background:${bg}; font-size:13px; color:${textColor};">なぜ：[理由]</span>

HTMLのみを返してください。説明文は不要です。`;
  }

  if (diagramType === "mindmap") {
    return `会話の内容をもとに、マインドマップ型のHTMLページを生成してください。
${commonDesign}

## マインドマップ型の構成
- Mermaid.js（CDN: https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js）を使って描画
- mindmap記法を使う
- 図の下に補足テキストセクションを設ける

HTMLのみを返してください。説明文は不要です。`;
  }

  if (diagramType === "step-flow") {
    return `会話の内容をもとに、STEP・フロー型のHTMLページを生成してください。
${commonDesign}

## STEP・フロー型の構成
- Mermaid.js（CDN: https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js）を使って描画
- flowchart TD記法を使う
- 各STEPの下に補足テキストを設ける

HTMLのみを返してください。説明文は不要です。`;
  }

  return `会話の内容をもとにHTMLページを生成してください。${commonDesign}`;
}
