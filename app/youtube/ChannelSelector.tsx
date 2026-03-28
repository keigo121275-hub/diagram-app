"use client";

import { useEffect, useState } from "react";
import { Channel, Video } from "@/lib/types";
import VideoList from "./VideoList";
import BottleneckView from "./BottleneckView";
import YoutubeLoading from "./YoutubeLoading";

type PageView = "list" | "bottleneck";

export default function ChannelSelector() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selected, setSelected] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageView, setPageView] = useState<PageView>("list");
  const [sharedVideos, setSharedVideos] = useState<Video[]>([]);

  // チャンネル一覧取得後、localStorage から前回選択を復元する
  useEffect(() => {
    fetch("/api/youtube/channels")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setChannels(data.channels);

          // localStorage に保存済みの channelId があれば自動選択
          const savedId = localStorage.getItem("yt_selected_channel");
          const savedView = (localStorage.getItem("yt_page_view") as PageView) ?? "list";
          if (savedId) {
            const match = (data.channels as Channel[]).find((c) => c.id === savedId);
            if (match) {
              setSelected(match);
              setPageView(savedView);
            }
          } else if (data.channels.length === 1) {
            setSelected(data.channels[0]);
          }
        }
      })
      .catch(() => setError("チャンネル一覧の取得に失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  function selectChannel(ch: Channel) {
    setSelected(ch);
    setPageView("list");
    setSharedVideos([]);
    localStorage.setItem("yt_selected_channel", ch.id);
    localStorage.setItem("yt_page_view", "list");
  }

  function deselectChannel() {
    setSelected(null);
    setPageView("list");
    localStorage.removeItem("yt_selected_channel");
    localStorage.removeItem("yt_page_view");
  }

  function switchView(view: PageView) {
    setPageView(view);
    localStorage.setItem("yt_page_view", view);
  }

  if (loading) {
    return <YoutubeLoading message="チャンネルを読み込み中..." />;
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
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-4 sm:mb-5 min-w-0">
          <button
            onClick={deselectChannel}
            className="text-gray-400 hover:text-white text-sm transition-colors text-left w-fit"
          >
            ← チャンネル選択に戻る
          </button>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {selected.thumbnail && (
              <img src={selected.thumbnail} alt={selected.name} className="w-8 h-8 rounded-full flex-shrink-0" />
            )}
            <span className="font-semibold text-white truncate">{selected.name}</span>
          </div>
        </div>

        {/* page tabs */}
        <div className="flex flex-wrap gap-2 mb-5 sm:mb-6 border-b border-gray-800 pb-3 sm:pb-4">
          <button
            onClick={() => switchView("list")}
            className={`px-3 py-2 sm:px-4 rounded-lg text-xs sm:text-sm font-medium transition-colors flex-1 sm:flex-none min-w-[calc(50%-4px)] sm:min-w-0 ${
              pageView === "list"
                ? "bg-red-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            動画一覧
          </button>
          <button
            onClick={() => switchView("bottleneck")}
            className={`px-3 py-2 sm:px-4 rounded-lg text-xs sm:text-sm font-medium transition-colors flex-1 sm:flex-none min-w-[calc(50%-4px)] sm:min-w-0 ${
              pageView === "bottleneck"
                ? "bg-red-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            ボトルネック分析
          </button>
        </div>

        {pageView === "list" && (
          <VideoList channelId={selected.id} uploadsPlaylistId={selected.uploadsPlaylistId} onVideosChange={setSharedVideos} />
        )}
        {pageView === "bottleneck" && (
          <BottleneckView channelId={selected.id} uploadsPlaylistId={selected.uploadsPlaylistId} sharedVideos={sharedVideos} />
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-5">
        <h2 className="text-base sm:text-lg font-semibold text-gray-300">
          分析するチャンネルを選んでください
        </h2>
        <a
          href="/youtube/connect"
          className="text-sm text-gray-500 hover:text-white transition-colors shrink-0"
        >
          チャンネルを管理する
        </a>
      </div>
      <div className="grid gap-3 w-full max-w-full sm:max-w-xl">
        {channels.map((ch) => (
          <button
            key={ch.id}
            onClick={() => selectChannel(ch)}
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
