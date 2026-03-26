"use client";

import { useEffect, useMemo, useState } from "react";
import { Video } from "@/lib/types";

type Props = {
  channelId: string;
  uploadsPlaylistId: string;
};

export default function VideoList({ channelId, uploadsPlaylistId }: Props) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyticsUnavailable, setAnalyticsUnavailable] = useState(false);
  const [channelCtr, setChannelCtr] = useState<number | null>(null);

  // Step1: 動画一覧を取得
  useEffect(() => {
    if (!channelId || !uploadsPlaylistId) return;

    const params = new URLSearchParams({ channelId, uploadsPlaylistId });
    fetch(`/api/youtube/videos?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setVideos(data.videos);
        }
      })
      .catch(() => setError("動画の取得に失敗しました"))
      .finally(() => setLoading(false));
  }, [channelId, uploadsPlaylistId]);

  // Step2: 動画一覧が揃ったらアナリティクスを取得してマージ
  useEffect(() => {
    if (videos.length === 0) return;

    setAnalyticsLoading(true);
    const videoIds = videos.map((v) => v.id).join(",");
    const params = new URLSearchParams({ channelId, videoIds });

    fetch(`/api/youtube/analytics?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.forbidden) {
          setAnalyticsUnavailable(true);
          return;
        }
        if (data.channelCtr != null) {
          setChannelCtr(data.channelCtr);
        }
        if (data.analytics) {
          const analyticsMap = new Map(
            data.analytics.map((a: { videoId: string; avgViewPercent: number | null }) => [
              a.videoId,
              a,
            ])
          );
          setVideos((prev) =>
            prev.map((v) => {
              const a = analyticsMap.get(v.id) as { avgViewPercent: number | null } | undefined;
              return a ? { ...v, avgViewPercent: a.avgViewPercent } : v;
            })
          );
        }
      })
      .catch(() => {
        // アナリティクス取得失敗は無視（基本データは表示する）
      })
      .finally(() => setAnalyticsLoading(false));
  }, [videos.length, channelId]);

  // チャンネル平均を計算する（動画データが揃ってから）
  const channelStats = useMemo(() => {
    if (videos.length === 0) return null;

    const avgViews =
      videos.reduce((sum, v) => sum + Number(v.viewCount), 0) / videos.length;

    const videosWithRetention = videos.filter((v) => v.avgViewPercent != null);
    const avgRetention =
      videosWithRetention.length > 0
        ? videosWithRetention.reduce(
            (sum, v) => sum + (v.avgViewPercent ?? 0),
            0
          ) / videosWithRetention.length
        : null;

    // ヒット動画 = 再生数がチャンネル平均の5倍以上
    const hitCount = videos.filter(
      (v) => Number(v.viewCount) >= avgViews * 5
    ).length;

    return { avgViews, avgRetention, hitCount };
  }, [videos]);

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
      {/* チャンネルサマリーバー */}
      {channelStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard
            label="チャンネル平均再生数"
            value={Math.round(channelStats.avgViews).toLocaleString()}
            sub={`直近${videos.length}本の平均`}
          />
          <StatCard
            label="チャンネルCTR"
            value={
              channelCtr != null
                ? `${(channelCtr * 100).toFixed(1)}%`
                : analyticsLoading
                ? "取得中..."
                : "—"
            }
            sub="サムネのクリック率（全体）"
          />
          <StatCard
            label="平均視聴維持率"
            value={
              channelStats.avgRetention != null
                ? `${channelStats.avgRetention.toFixed(1)}%`
                : analyticsLoading
                ? "取得中..."
                : "—"
            }
            sub="動画全体の平均"
          />
          <StatCard
            label="ヒット動画数"
            value={`${channelStats.hitCount}本`}
            sub={`平均5倍以上 / ${videos.length}本中`}
            highlight={channelStats.hitCount > 0}
          />
        </div>
      )}

      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-gray-300">
          最新の動画 ({videos.length}本)
        </h2>
        {analyticsLoading && (
          <span className="text-xs text-gray-500 flex items-center gap-1.5">
            <span className="animate-spin inline-block w-3 h-3 border border-gray-500 border-t-transparent rounded-full" />
            アナリティクス取得中...
          </span>
        )}
        {analyticsUnavailable && (
          <span className="text-xs text-yellow-600">
            ⚠ アナリティクスの権限なし（再生数のみ表示）
          </span>
        )}
      </div>

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
              <div className="flex items-start gap-2 mb-2">
                <h3 className="font-medium text-white leading-snug line-clamp-2 flex-1">
                  {video.title}
                </h3>
                <PerformanceBadge viewCount={Number(video.viewCount)} avgViews={channelStats?.avgViews ?? 0} />
              </div>
              <p className="text-sm text-gray-500 mb-3">
                {new Date(video.publishedAt).toLocaleDateString("ja-JP")}
              </p>

              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <Stat label="再生数" value={Number(video.viewCount).toLocaleString()} />
                <Stat label="高評価" value={Number(video.likeCount).toLocaleString()} />
                <Stat
                  label="視聴維持率"
                  value={
                    video.avgViewPercent != null
                      ? `${video.avgViewPercent.toFixed(1)}%`
                      : analyticsLoading
                      ? "..."
                      : analyticsUnavailable
                      ? "—"
                      : "—"
                  }
                  highlight={
                    video.avgViewPercent != null
                      ? retentionColor(video.avgViewPercent)
                      : undefined
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: string;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-bold ${highlight ?? "text-white"}`}>{value}</p>
    </div>
  );
}

// CTR の水準に応じて色をつける
// 業界平均: 2〜10%。4%以上で良好とする
function ctrColor(ctr: number): string {
  const pct = ctr * 100;
  if (pct >= 6) return "text-green-400";
  if (pct >= 4) return "text-yellow-400";
  return "text-red-400";
}

// 視聴維持率の水準に応じて色をつける
// 40%以上で良好とする
function retentionColor(pct: number): string {
  if (pct >= 40) return "text-green-400";
  if (pct >= 30) return "text-yellow-400";
  return "text-red-400";
}

// チャンネル平均再生数との比率でパフォーマンスランクを判定する
function getPerformanceRank(viewCount: number, avgViews: number) {
  if (avgViews === 0) return null;
  const ratio = viewCount / avgViews;
  if (ratio >= 5.0) return { label: "🔥 ヒット",      color: "bg-yellow-900/60 text-yellow-400 border border-yellow-700" };
  if (ratio >= 2.0) return { label: "✓ 好調",         color: "bg-green-900/60  text-green-400  border border-green-700"  };
  if (ratio >= 1.0) return { label: "— 普通",         color: "bg-gray-800      text-gray-400   border border-gray-700"  };
  return              { label: "✗ 伸びなかった", color: "bg-red-900/60   text-red-400    border border-red-800"   };
}

function PerformanceBadge({ viewCount, avgViews }: { viewCount: number; avgViews: number }) {
  const rank = getPerformanceRank(viewCount, avgViews);
  if (!rank) return null;
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${rank.color}`}>
      {rank.label}
    </span>
  );
}

// チャンネルサマリーバーの1マス
function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p
        className={`text-2xl font-bold ${highlight ? "text-yellow-400" : "text-white"}`}
      >
        {value}
      </p>
      <p className="text-xs text-gray-600 mt-1">{sub}</p>
    </div>
  );
}
