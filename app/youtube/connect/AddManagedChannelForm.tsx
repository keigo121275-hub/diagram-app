"use client";

/**
 * 権限共有チャンネルをチャンネルIDで追加するフォーム。
 *
 * OAuth 後に `step=add-managed` で connect ページが開いたとき表示する。
 * チャンネルIDを入力 → /api/youtube/channels/add へ POST →
 *   成功: ページをリロードして接続済み一覧に反映
 *   失敗: エラーメッセージを表示
 */
import { useState } from "react";

export default function AddManagedChannelForm() {
  const [channelId, setChannelId] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    const res = await fetch("/api/youtube/channels/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: channelId.trim() }),
    });
    const data = await res.json();

    if (data.ok) {
      setStatus("success");
      setMessage(`✅「${data.channelName}」を追加しました`);
      setChannelId("");
      // 接続済み一覧に反映
      setTimeout(() => window.location.reload(), 1200);
    } else {
      setStatus("error");
      setMessage(data.error ?? "エラーが発生しました");
    }
  }

  return (
    <div className="bg-gray-900 border border-yellow-600/40 rounded-xl p-6 mb-6">
      <h2 className="font-semibold text-white mb-1">
        権限共有チャンネルをIDで追加する
      </h2>
      <p className="text-sm text-gray-400 mb-4">
        YouTubeスタジオで管理者として招待されているチャンネルは、
        チャンネルIDを入力して追加できます。
      </p>

      {/* チャンネルIDの調べ方 */}
      <details className="text-xs text-gray-500 mb-4 cursor-pointer">
        <summary className="hover:text-gray-300 transition-colors">
          チャンネルIDの調べ方
        </summary>
        <ol className="mt-2 space-y-1 list-decimal list-inside leading-relaxed">
          <li>そのチャンネルの YouTube ページを開く</li>
          <li>URLの <code className="text-gray-300">@チャンネル名</code> 部分をクリック → チャンネルページへ</li>
          <li>URLが <code className="text-gray-300">youtube.com/channel/UCxxxx</code> の形なら <code className="text-gray-300">UCxxxx</code> がID</li>
          <li>または YouTube Studio → 設定 → チャンネル → 詳細設定 に記載</li>
        </ol>
      </details>

      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
          placeholder="UCxxxxxxxxxxxxxxxxxx"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500"
          required
        />
        <button
          type="submit"
          disabled={status === "loading" || !channelId.trim()}
          className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors whitespace-nowrap"
        >
          {status === "loading" ? "確認中..." : "テスト接続"}
        </button>
      </form>

      {message && (
        <p
          className={`mt-3 text-sm ${
            status === "success" ? "text-green-400" : "text-red-400"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
