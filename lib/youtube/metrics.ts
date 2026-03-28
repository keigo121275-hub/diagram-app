import type { TimeTab, VideoTimeseries } from "./types";

export function ctrColor(ctr: number): string {
  const pct = ctr * 100;
  if (pct >= 6) return "text-green-400";
  if (pct >= 4) return "text-yellow-400";
  return "text-red-400";
}

export function retentionColor(pct: number): string {
  if (pct >= 40) return "text-green-400";
  if (pct >= 30) return "text-yellow-400";
  return "text-red-400";
}

export function getPerformanceRank(viewCount: number, avgViews: number) {
  if (avgViews === 0) return null;
  const ratio = viewCount / avgViews;
  if (ratio >= 5.0)
    return {
      label: "🔥 ヒット",
      color: "bg-yellow-900/60 text-yellow-400 border border-yellow-700",
    };
  if (ratio >= 2.0)
    return {
      label: "✓ 好調",
      color: "bg-green-900/60  text-green-400  border border-green-700",
    };
  if (ratio >= 1.0)
    return {
      label: "— 普通",
      color: "bg-gray-800      text-gray-400   border border-gray-700",
    };
  return {
    label: "✗ 伸びなかった",
    color: "bg-red-900/60   text-red-400    border border-red-800",
  };
}

export function getTabViews(
  videoId: string,
  tab: TimeTab,
  viewCount: string,
  timeseriesMap: Map<string, VideoTimeseries>,
  loading: boolean
): string {
  if (tab === "lifetime") return Number(viewCount).toLocaleString();
  if (loading) return "取得中...";
  const ts = timeseriesMap.get(videoId);
  if (!ts) return "—";
  const v =
    tab === "1d"
      ? ts.views1d
      : tab === "3d"
        ? ts.views3d
        : tab === "7d"
          ? ts.views7d
          : ts.views30d;
  return v != null ? v.toLocaleString() : "—";
}
