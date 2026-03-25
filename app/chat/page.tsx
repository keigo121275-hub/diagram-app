/**
 * チャットページ（/chat）
 *
 * 役割：AIと1問ずつやりとりして情報を集め、HTMLを生成・表示する。
 *
 * 流れ：
 *   ① 画面が開いたらAIの最初のメッセージを表示
 *   ② ユーザーが会話を貼り付け → AIが質問 → ユーザーが答える（繰り返し）
 *   ③ AIが [COMPLETE] を返したら「資料を生成する」ボタンを表示
 *   ④ ボタンを押すと /api/generate を呼んでHTMLを取得
 *   ⑤ iframeにHTMLを表示 + ダウンロード・別タブで開くボタンを出す
 *
 * URLパラメータ：
 *   type: "mindmap" | "step-flow" | "report"
 *   tone: "good" | "normal"（reportのときのみ）
 */

"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

// ─────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
}

// ─────────────────────────────────────────────
// ヘルパー関数
// ─────────────────────────────────────────────

// 図の種類に応じた最初のメッセージを返す
function getGreeting(diagramType: string): string {
  const greetings: Record<string, string> = {
    report:     "こんにちは！報告内容を図解します。\nまず、報告したい内容をそのまま貼り付けてください。",
    mindmap:    "こんにちは！マインドマップを作ります。\n整理したい会話や内容をそのまま貼り付けてください。",
    "step-flow": "こんにちは！フロー図を作ります。\n整理したい会話や内容をそのまま貼り付けてください。",
  };
  return greetings[diagramType] ?? greetings["report"];
}

// ヘッダーに表示する図の種類ラベル
function getTypeLabel(diagramType: string, reportTone: string): string {
  const labels: Record<string, string> = {
    mindmap:     "マインドマップ型",
    "step-flow": "STEP・フロー型",
    report:      reportTone === "good" ? "報告型（良い報告）" : "報告型（普通/改善）",
  };
  return labels[diagramType] ?? diagramType;
}

// ─────────────────────────────────────────────
// メインのチャットコンポーネント
// ─────────────────────────────────────────────

function ChatContent() {
  // URLパラメータから図の種類とトーンを取得
  const searchParams = useSearchParams();
  const diagramType = searchParams.get("type") ?? "report";
  const reportTone  = searchParams.get("tone") ?? "good";

  // ── 状態管理 ──────────────────────────────

  // 会話の履歴（AIとユーザーのやりとりを配列で管理）
  const [messages, setMessages]       = useState<Message[]>([]);

  // 入力欄のテキスト
  const [input, setInput]             = useState("");

  // AIが返事を考えている間 true
  const [isLoading, setIsLoading]     = useState(false);

  // AIが「情報が揃った」と判断したら true → 生成ボタンを表示
  const [isComplete, setIsComplete]   = useState(false);

  // 生成されたHTMLを保持（null なら未生成）
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);

  // HTML生成中は true
  const [isGenerating, setIsGenerating] = useState(false);

  // スクロール用の参照（メッセージ追加時に一番下へ）
  const bottomRef = useRef<HTMLDivElement>(null);

  // エンター2回送信のために直前のEnterキー押下時刻を保持
  const lastEnterTimeRef = useRef<number>(0);

  // ── 初期化 ──────────────────────────────

  // 画面が開いたときに最初のAIメッセージをセット
  useEffect(() => {
    setMessages([{ role: "assistant", content: getGreeting(diagramType) }]);
  }, [diagramType]);

  // メッセージが増えるたびに自動スクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── イベントハンドラ ──────────────────────

  // メッセージを送信する
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      // /api/chat に会話履歴を送り、AIの返事をもらう
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages:    updatedMessages,
          diagramType,
          reportTone,
        }),
      });

      const data = await res.json();

      // AIの返事を会話履歴に追加
      setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);

      // isComplete が true なら生成ボタンを表示する
      if (data.isComplete) setIsComplete(true);

    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "エラーが発生しました。もう一度お試しください。" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // HTMLを生成する（「資料を生成する」ボタンを押したとき）
  const generateHtml = async () => {
    setIsGenerating(true);
    try {
      // /api/generate に会話履歴を送り、HTMLをもらう
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, diagramType, reportTone }),
      });

      const data = await res.json();
      setGeneratedHtml(data.html);

    } catch {
      alert("HTMLの生成に失敗しました。もう一度お試しください。");
    } finally {
      setIsGenerating(false);
    }
  };

  // HTMLをファイルとしてダウンロードする
  const downloadHtml = () => {
    if (!generatedHtml) return;
    const blob = new Blob([generatedHtml], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "diagram.html";
    a.click();
    URL.revokeObjectURL(url);
  };

  // 別タブでHTMLを開く
  const openInNewTab = () => {
    if (!generatedHtml) return;
    const blob = new Blob([generatedHtml], { type: "text/html" });
    window.open(URL.createObjectURL(blob), "_blank");
  };

  // キー操作：Shift+Enter=改行 / Enter2回=送信 / Enter1回=改行（変換猶予）
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    if (e.shiftKey) return; // Shift+Enter はデフォルトの改行動作に任せる
    if (e.nativeEvent.isComposing) return; // IME変換中はEnterを送信に使わない

    e.preventDefault();
    const now = Date.now();
    if (now - lastEnterTimeRef.current < 500) {
      // 500ms以内に2回Enterが押された → 送信
      sendMessage();
      lastEnterTimeRef.current = 0;
    } else {
      // 1回目のEnter → 改行だけ入れて待機
      setInput((prev) => prev + "\n");
      lastEnterTimeRef.current = now;
    }
  };

  // ── レンダリング ──────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <a href="/" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">← 戻る</a>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-bold text-gray-700">{getTypeLabel(diagramType, reportTone)}</span>
      </header>

      {/* HTMLが生成されたらプレビューを全画面表示 */}
      {generatedHtml ? (
        <div className="flex-1 flex flex-col">
          {/* プレビューのツールバー */}
          <div className="bg-green-50 border-b border-green-200 px-6 py-3 flex items-center justify-between">
            <span className="text-sm font-bold text-green-700">✅ 資料が生成されました</span>
            <div className="flex gap-3">
              <button onClick={downloadHtml} className="text-xs bg-white border border-green-300 text-green-700 px-4 py-2 rounded-lg font-bold hover:bg-green-50 transition-colors">
                ダウンロード
              </button>
              <button onClick={openInNewTab} className="text-xs bg-green-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-600 transition-colors">
                別タブで開く
              </button>
            </div>
          </div>
          {/* iframeでHTMLをそのまま表示 */}
          <iframe srcDoc={generatedHtml} className="flex-1 w-full border-0" title="生成されたHTML" />
        </div>

      ) : (
        <>
          {/* チャットエリア */}
          <div className="flex-1 overflow-y-auto px-4 py-6 max-w-2xl mx-auto w-full">
            <div className="flex flex-col gap-4">

              {/* メッセージ一覧 */}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-blue-500 text-white rounded-br-sm"
                      : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}

              {/* AIが考え中のローディング表示 */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm">
                    <div className="flex gap-1 items-center h-4">
                      {[0, 150, 300].map((delay) => (
                        <span key={delay} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 情報が揃ったら「資料を生成する」ボタンを表示 */}
              {isComplete && !isGenerating && (
                <div className="flex justify-center mt-4">
                  <button onClick={generateHtml} className="bg-orange-500 text-white px-8 py-4 rounded-2xl font-bold text-sm hover:bg-orange-600 transition-all shadow-lg">
                    ✨ 資料を生成する
                  </button>
                </div>
              )}

              {/* HTML生成中のローディング */}
              {isGenerating && (
                <div className="flex justify-center mt-4">
                  <div className="text-sm text-gray-500 animate-pulse">資料を生成中...</div>
                </div>
              )}

              {/* スクロール用の空要素 */}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* メッセージ入力エリア */}
          <div className="bg-white border-t border-gray-200 px-4 py-4">
            <div className="max-w-2xl mx-auto flex gap-3 items-end">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="メッセージを入力（Enter2回で送信 / Shift+Enterで改行）"
                rows={2}
                disabled={isLoading || isComplete} // AI処理中・完了後は入力不可
                className="flex-1 resize-none border border-gray-300 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 disabled:bg-gray-50 disabled:text-gray-400"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading || isComplete}
                className="bg-blue-500 text-white w-11 h-11 rounded-2xl flex items-center justify-center hover:bg-blue-600 disabled:bg-gray-200 disabled:cursor-not-allowed transition-all flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Suspenseで包む理由：useSearchParams() はサスペンスが必要なため
export default function ChatPage() {
  return (
    <Suspense>
      <ChatContent />
    </Suspense>
  );
}
