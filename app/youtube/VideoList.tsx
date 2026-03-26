"use client";

import { useEffect, useState } from "react";

type Video = {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  viewCount: string;
  likeCount: string;
};

export default function VideoList({ uploadsPlaylistId }: { uploadsPlaylistId: string }) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uploadsPlaylistId) return;

    fetch(`/api/youtube/videos?uploadsPlaylistId=${encodeURIComponent(uploadsPlaylistId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setVideos(data.videos);
      })
      .catch(() => setError("動画の取得に失敗しました"))
      .finally(() => setLoading(false));
  }, [uploadsPlaylistId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mr-3" />
        動画を読み込み中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700 rounded-xl p-6 text-red-400">
        エラー: {error}
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-300 mb-5">
        最新の動画 ({videos.length}本)
      </h2>
      <div className="grid gap-4">
        {videos.map((video) => (
          <div
            key={video.id}
            className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-4 hover:border-gray-600 transition-colors"
          >
            <img
              src={video.thumbnail}
              alt={video.title}
              className="w-40 h-24 object-cover rounded-lg flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-white leading-snug line-clamp-2 mb-2">
                {video.title}
              </h3>
              <p className="text-sm text-gray-500 mb-3">
                {new Date(video.publishedAt).toLocaleDateString("ja-JP")}
              </p>
              <div className="flex gap-6">
                <div>
                  <p className="text-xs text-gray-500">再生数</p>
                  <p className="text-lg font-bold text-white">
                    {Number(video.viewCount).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">高評価</p>
                  <p className="text-lg font-bold text-white">
                    {Number(video.likeCount).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
