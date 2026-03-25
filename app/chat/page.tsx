// 【このファイルの役割】
// AIと1問ずつやりとりする画面
// 情報が揃ったら「資料を生成する」ボタンが出て、HTMLプレビューが表示される

"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface Message {
  role: "user" | "assistant";
  content: string;
}

function ChatContent() {
  const searchParams = useSearchParams();
  const diagramType = searchParams.get("type") || "report";
  const reportTone = searchParams.get("tone") || "good";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 最初のメッセージ：AIから「会話を貼ってください」と始める
  useEffect(() => {
    const greeting = getGreeting(diagramType);
    setMessages([{ role: "assistant", content: greeting }]);
  }, [diagramType]);

  // メッセージが増えるたびに一番下にスクロールする
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ユーザーがメッセージを送信する
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      // API Route（/api/chat）に会話を送る
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          diagramType,
          reportTone,
        }),
      });

      const data = await res.json();

      // Claudeの返事をメッセージに追加する
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message },
      ]);

      // isCompleteがtrueになったら「生成する」ボタンを表示
      if (data.isComplete) {
        setIsComplete(true);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "エラーが発生しました。もう一度お試しください。" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // 「資料を生成する」ボタンを押したとき
  const generateHtml = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, diagramType, reportTone }),
      });

      const data = await res.json();
      setGeneratedHtml(data.html);
    } catch {
      alert("生成に失敗しました。もう一度お試しください。");
    } finally {
      setIsGenerating(false);
    }
  };

  // Enterキーで送信（Shift+Enterは改行）
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const typeLabel: Record<string, string> = {
    mindmap: "マインドマップ型",
    "step-flow": "STEP・フロー型",
    report: reportTone === "good" ? "報告型（良い報告）" : "報告型（普通/改善）",
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <a href="/" className="text-sm text-gray-400 hover:text-gray-600">← 戻る</a>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-bold text-gray-700">{typeLabel[diagramType]}</span>
      </header>

      {/* HTMLプレビューが生成されたら表示 */}
      {generatedHtml ? (
        <div className="flex-1 flex flex-col">
          <div className="bg-green-50 border-b border-green-200 px-6 py-3 flex items-center justify-between">
            <span className="text-sm font-bold text-green-700">✅ 資料が生成されました</span>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const blob = new Blob([generatedHtml], { type: "text/html" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "diagram.html";
                  a.click();
                }}
                className="text-xs bg-white border border-green-300 text-green-700 px-4 py-2 rounded-lg font-bold hover:bg-green-50"
              >
                ダウンロード
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([generatedHtml], { type: "text/html" });
                  const url = URL.createObjectURL(blob);
                  window.open(url, "_blank");
                }}
                className="text-xs bg-green-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-600"
              >
                別タブで開く
              </button>
            </div>
          </div>
          <iframe
            srcDoc={generatedHtml}
            className="flex-1 w-full border-0"
            title="生成されたHTML"
          />
        </div>
      ) : (
        <>
          {/* チャットエリア */}
          <div className="flex-1 overflow-y-auto px-4 py-6 max-w-2xl mx-auto w-full">
            <div className="flex flex-col gap-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-blue-500 text-white rounded-br-sm"
                        : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {/* ローディング表示 */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm">
                    <div className="flex gap-1 items-center h-4">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}

              {/* 情報が揃ったら「生成する」ボタンを表示 */}
              {isComplete && !isGenerating && (
                <div className="flex justify-center mt-4">
                  <button
                    onClick={generateHtml}
                    className="bg-orange-500 text-white px-8 py-4 rounded-2xl font-bold text-sm hover:bg-orange-600 transition-all shadow-lg"
                  >
                    ✨ 資料を生成する
                  </button>
                </div>
              )}

              {isGenerating && (
                <div className="flex justify-center mt-4">
                  <div className="text-sm text-gray-500 animate-pulse">資料を生成中...</div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          {/* 入力エリア */}
          <div className="bg-white border-t border-gray-200 px-4 py-4">
            <div className="max-w-2xl mx-auto flex gap-3 items-end">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="メッセージを入力（Enterで送信 / Shift+Enterで改行）"
                rows={2}
                disabled={isLoading || isComplete}
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

function getGreeting(diagramType: string): string {
  if (diagramType === "report") {
    return "こんにちは！報告内容を図解します。\nまず、報告したい内容をそのまま貼り付けてください。";
  }
  if (diagramType === "mindmap") {
    return "こんにちは！マインドマップを作ります。\n整理したい会話や内容をそのまま貼り付けてください。";
  }
  return "こんにちは！フロー図を作ります。\n整理したい会話や内容をそのまま貼り付けてください。";
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatContent />
    </Suspense>
  );
}
