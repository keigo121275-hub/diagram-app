"use client";

import { useEffect, useState } from "react";
import { Channel } from "@/lib/types";
import VideoList from "./VideoList";
import BottleneckView from "./BottleneckView";

type PageView = "list" | "bottleneck";

export default function ChannelSelector() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selected, setSelected] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageView, setPageView] = useState<PageView>("list");

  useEffect(() => {
    fetch("/api/youtube/channels")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setChannels(data.channels);
          // チャンネルが1件だけなら自動選択
          if (data.channels.length === 1) {
            setSelected(data.channels[0]);
          }
        }
      })
      .catch(() => setError("チャンネル一覧の取得に失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mr-3" />
        チャンネルを読み込み中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700 rounded-xl p-6 text-red-400">
        <p className="mb-3">{error}</p>
        <a
          href="/youtube/connect"
          className="inline-block bg-red-600 hover:bg-red-500 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          チャンネルを接続する →
        </a>
      </div>
    );
  }

  if (selected) {
    return (
      <div>
        {/* channel header */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => { setSelected(null); setPageView("list"); }}
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            ← チャンネル選択に戻る
          </button>
          {selected.thumbnail && (
            <img src={selected.thumbnail} alt={selected.name} className="w-8 h-8 rounded-full" />
          )}
          <span className="font-semibold text-white">{selected.name}</span>
        </div>

        {/* page tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-800 pb-4">
          <button
            onClick={() => setPageView("list")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              pageView === "list"
                ? "bg-red-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            動画一覧
          </button>
          <button
            onClick={() => setPageView("bottleneck")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              pageView === "bottleneck"
                ? "bg-red-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            ボトルネック分析
          </button>
        </div>

        {pageView === "list" && (
          <VideoList channelId={selected.id} uploadsPlaylistId={selected.uploadsPlaylistId} />
        )}
        {pageView === "bottleneck" && (
          <BottleneckView channelId={selected.id} uploadsPlaylistId={selected.uploadsPlaylistId} />
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-gray-300">
          分析するチャンネルを選んでください
        </h2>
        <a
          href="/youtube/connect"
          className="text-sm text-gray-500 hover:text-white transition-colors"
        >
          チャンネルを管理する
        </a>
      </div>
      <div className="grid gap-3 max-w-xl">
        {channels.map((ch) => (
          <button
            key={ch.id}
            onClick={() => setSelected(ch)}
            className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-4 hover:border-red-500 transition-colors text-left"
          >
            {ch.thumbnail && (
              <img src={ch.thumbnail} alt={ch.name} className="w-12 h-12 rounded-full flex-shrink-0" />
            )}
            <div>
              <p className="font-semibold text-white">{ch.name}</p>
              <p className="text-sm text-gray-400">
                登録者 {Number(ch.subscriberCount).toLocaleString()}人 ·
                動画 {Number(ch.videoCount).toLocaleString()}本
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
