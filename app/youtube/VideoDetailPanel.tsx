"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Video } from "@/lib/types";

// recharts は SSR 非対応のため dynamic import で読み込む
const LineChart = dynamic(
  () => import("recharts").then((m) => m.LineChart),
  { ssr: false }
);
const Line = dynamic(
  () => import("recharts").then((m) => m.Line),
  { ssr: false }
);
const XAxis = dynamic(
  () => import("recharts").then((m) => m.XAxis),
  { ssr: false }
);
const YAxis = dynamic(
  () => import("recharts").then((m) => m.YAxis),
  { ssr: false }
);
const CartesianGrid = dynamic(
  () => import("recharts").then((m) => m.CartesianGrid),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import("recharts").then((m) => m.Tooltip),
  { ssr: false }
);
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false }
);

type SnapRecord = {
  views: number;
  likes: number;
  avgViewPercent: number | null;
  ctr: number | null;
  savedAt: string;
};

type Snapshot = {
  date: string;
  record: SnapRecord;
};

type Props = {
  video: Video | null;
  channelId: string;
  avgViews: number;
  onClose: () => void;
};

type ChartTab = "views" | "retention";

// チャンネル平均再生数との比率でランクを返す
function getPerformanceRank(viewCount: number, avgViews: number) {
  if (avgViews === 0) return null;
  const ratio = viewCount / avgViews;
  if (ratio >= 5.0) return { label: "🔥 ヒット",      color: "bg-yellow-900/60 text-yellow-400 border border-yellow-700" };
  if (ratio >= 2.0) return { label: "✓ 好調",         color: "bg-green-900/60  text-green-400  border border-green-700"  };
  if (ratio >= 1.0) return { label: "— 普通",         color: "bg-gray-800      text-gray-400   border border-gray-700"  };
  return              { label: "✗ 伸びなかった", color: "bg-red-900/60   text-red-400    border border-red-800"   };
}

function retentionColor(pct: number): string {
  if (pct >= 40) return "text-green-400";
  if (pct >= 30) return "text-yellow-400";
  return "text-red-400";
}

export default function VideoDetailPanel({ video, channelId, avgViews, onClose }: Props) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [chartTab, setChartTab] = useState<ChartTab>("views");

  useEffect(() => {
    if (!video) return;
    setSnapshots([]);
    setLoading(true);

    const params = new URLSearchParams({ channelId, videoId: video.id });
    fetch(`/api/youtube/snapshot?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.snapshots) {
          setSnapshots(data.snapshots);
        }
      })
      .catch(() => {/* 取得失敗は無視 */})
      .finally(() => setLoading(false));
  }, [video?.id, channelId]);

  // Escキーで閉じる
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!video) return null;

  const rank = getPerformanceRank(Number(video.viewCount), avgViews);

  // グラフ用データを組み立てる
  const chartData = snapshots.map((s) => ({
    date: s.date,
    views: s.record.views,
    retention: s.record.avgViewPercent,
  }));

  const hasRetentionData = chartData.some((d) => d.retention != null);

  return (
    <>
      {/* オーバーレイ */}
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
      />

      {/* ドロワー */}
      <div className="fixed right-0 top-0 h-full w-full max-w-xl bg-gray-950 border-l border-gray-800 z-50 overflow-y-auto shadow-2xl flex flex-col">

        {/* ヘッダー */}
        <div className="flex items-start gap-3 p-5 border-b border-gray-800">
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-28 h-16 object-cover rounded-lg flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-white leading-snug line-clamp-3 mb-1">
              {video.title}
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500">
                {new Date(video.publishedAt).toLocaleDateString("ja-JP")}
              </span>
              {rank && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${rank.color}`}>
                  {rank.label}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors text-xl leading-none flex-shrink-0 mt-0.5"
          >
            ✕
          </button>
        </div>

        {/* サマリー数値 */}
        <div className="grid grid-cols-4 gap-3 p-5 border-b border-gray-800">
          <MiniStat label="累計再生数" value={Number(video.viewCount).toLocaleString()} />
          <MiniStat label="高評価" value={Number(video.likeCount).toLocaleString()} />
          <MiniStat
            label="視聴維持率"
            value={video.avgViewPercent != null ? `${video.avgViewPercent.toFixed(1)}%` : "—"}
            valueClass={video.avgViewPercent != null ? retentionColor(video.avgViewPercent) : "text-gray-500"}
          />
          <MiniStat
            label="CTR"
            value="—"
            valueClass="text-gray-500"
          />
        </div>

        {/* グラフ */}
        <div className="p-5 flex-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-300">推移グラフ</h3>
            <div className="flex gap-2">
              <TabBtn active={chartTab === "views"} onClick={() => setChartTab("views")}>
                再生数
              </TabBtn>
              {hasRetentionData && (
                <TabBtn active={chartTab === "retention"} onClick={() => setChartTab("retention")}>
                  視聴維持率
                </TabBtn>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm gap-2">
              <span className="animate-spin inline-block w-4 h-4 border border-gray-500 border-t-transparent rounded-full" />
              データを取得中...
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-600 text-sm gap-2">
              <span className="text-2xl">📭</span>
              <p>スナップショットがまだありません</p>
              <p className="text-xs text-gray-700">「今すぐ記録」ボタンを押すと翌日以降に表示されます</p>
            </div>
          ) : chartData.length === 1 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-600 text-sm gap-2">
              <span className="text-2xl">📊</span>
              <p>
                {chartData[0].date} のデータが1件あります
              </p>
              <div className="mt-1 text-center text-gray-500">
                {chartTab === "views" ? (
                  <p className="text-2xl font-bold text-white">{chartData[0].views.toLocaleString()} 再生</p>
                ) : (
                  <p className="text-2xl font-bold text-green-400">
                    {chartData[0].retention != null ? `${(chartData[0].retention as number).toFixed(1)}%` : "—"}
                  </p>
                )}
              </div>
              <p className="text-xs text-gray-700 mt-1">翌日以降にデータが2件以上になるとグラフが表示されます</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#6B7280", fontSize: 11 }}
                  tickLine={false}
                  tickFormatter={(v: string) => v.slice(5)} // MM-DD だけ表示
                />
                <YAxis
                  tick={{ fill: "#6B7280", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) =>
                    chartTab === "retention" ? `${v}%` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
                  }
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111827",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#E5E7EB",
                  }}
                  formatter={(value) => {
                    const v = value as number | undefined;
                    return chartTab === "retention"
                      ? [`${v?.toFixed(1) ?? "—"}%`, "視聴維持率"]
                      : [v?.toLocaleString() ?? "—", "再生数"];
                  }}
                  labelFormatter={(label) => `📅 ${label}`}
                />
                {chartTab === "views" ? (
                  <Line
                    type="monotone"
                    dataKey="views"
                    stroke="#EF4444"
                    strokeWidth={2}
                    dot={{ fill: "#EF4444", r: 4 }}
                    activeDot={{ r: 6 }}
                    connectNulls
                  />
                ) : (
                  <Line
                    type="monotone"
                    dataKey="retention"
                    stroke="#34D399"
                    strokeWidth={2}
                    dot={{ fill: "#34D399", r: 4 }}
                    activeDot={{ r: 6 }}
                    connectNulls
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}

          {/* スナップショット数 */}
          {!loading && chartData.length > 1 && (
            <p className="text-xs text-gray-600 mt-3 text-right">
              {chartData.length} 日分のスナップショット
            </p>
          )}
        </div>
      </div>
    </>
  );
}

function MiniStat({
  label,
  value,
  valueClass = "text-white",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-lg font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
        active ? "bg-red-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
