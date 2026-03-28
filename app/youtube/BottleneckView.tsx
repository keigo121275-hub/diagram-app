"use client";

import { useEffect, useMemo, useState } from "react";
import { Video } from "@/lib/types";

// ── 型定義 ────────────────────────────────────────────────────────────────────

type ManualCtrData = {
  videoId: string;
  impressions: number | null;
  ctr: number | null;
  updatedAt: string | null;
  sources?: { name: string; impressions: number | null; ctr: number | null }[];
};

type TimeseriesData = {
  videoId: string;
  views1d: number | null;
  views3d: number | null;
  views7d: number | null;
  views30d: number | null;
};

// 5種類の診断
type Diagnosis = "win" | "velocity" | "thumbnail" | "content" | "all";
type SortMode = "priority" | "ctr" | "retention" | "velocity" | "views";
type VideoTypeTab = "all" | "long" | "short";

const DIAG_CONFIG: Record<Diagnosis, {
  label: string; emoji: string; color: string; bg: string; pill: string; pillText: string; advice: string;
}> = {
  win: {
    label: "勝ちパターン", emoji: "🏆", color: "#34d399", bg: "rgba(52,211,153,.07)",
    pill: "bg-emerald-500/15 text-emerald-400", pillText: "🏆 勝ち",
    advice: "このフォーマットを横展開しましょう。タイトル構成・テーマ・尺を他の動画に応用してください。",
  },
  velocity: {
    label: "初速問題", emoji: "🚀", color: "#a78bfa", bg: "rgba(167,139,250,.07)",
    pill: "bg-violet-500/15 text-violet-400", pillText: "🚀 初速",
    advice: "コンテンツ品質は高いですが初速が足りません。投稿後48時間以内のSNS告知・LINE配信を強化してください。",
  },
  thumbnail: {
    label: "サムネ改善", emoji: "🖼", color: "#fbbf24", bg: "rgba(251,191,36,.06)",
    pill: "bg-amber-500/15 text-amber-400", pillText: "🖼 サムネ",
    advice: "視聴維持率は良好ですがクリックされていません。サムネイルとタイトルを改善してみてください。",
  },
  content: {
    label: "内容改善", emoji: "📺", color: "#60a5fa", bg: "rgba(96,165,250,.06)",
    pill: "bg-blue-500/15 text-blue-400", pillText: "📺 内容",
    advice: "クリックはされていますが視聴が続きません。冒頭3分の掴みと動画構成を見直してください。",
  },
  all: {
    label: "全面見直し", emoji: "❌", color: "#f87171", bg: "rgba(239,68,68,.06)",
    pill: "bg-red-500/15 text-red-400", pillText: "❌ 全面",
    advice: "すべての指標に課題があります。テーマ選びとターゲット設定から見直すことをおすすめします。",
  },
};

// ── 3軸診断ロジック ──────────────────────────────────────────────────────────

function getDiagnosis(
  ctr: number | null,
  ret: number | null,
  velocityRatio: number | null, // video.views1d / avgViews1d（1.0 = チャンネル平均）
  avgCtr: number,
  avgRet: number,
): Diagnosis {
  const hRet = ret != null && ret >= avgRet;
  const hCtr = ctr != null && ctr >= avgCtr;
  const lCtr = ctr != null && ctr < avgCtr;
  const badVel = velocityRatio != null && velocityRatio < 0.7; // 平均の70%未満を「初速悪い」とする

  if (ctr != null) {
    if (hCtr && hRet && badVel) return "velocity";
    if (hCtr && hRet)           return "win";
    if (lCtr && hRet)           return "thumbnail";
    if (hCtr && !hRet)          return "content";
    return "all";
  } else {
    // CTRなし → 維持率＋初速の2軸
    if (hRet && badVel) return "velocity";
    if (hRet)           return "win";
    if (!hRet && !badVel && velocityRatio != null) return "content";
    return "all";
  }
}

type Props = { channelId: string; uploadsPlaylistId: string; sharedVideos?: Video[] };

export default function BottleneckView({ channelId, uploadsPlaylistId, sharedVideos }: Props) {
  const [videos, setVideos] = useState<Video[]>(sharedVideos ?? []);
  const [loading, setLoading] = useState(!(sharedVideos?.length));
  const [manualCtrMap, setManualCtrMap] = useState<Map<string, ManualCtrData>>(new Map());
  const [timeseriesMap, setTimeseriesMap] = useState<Map<string, TimeseriesData>>(new Map());
  const [sortMode, setSortMode] = useState<SortMode>("priority");
  const [typeTab, setTypeTab] = useState<VideoTypeTab>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  // ── sharedVideos 同期 ────────────────────────────────────────────────────
  useEffect(() => {
    if (sharedVideos?.length && videos.length === 0) {
      setVideos(sharedVideos);
      setLoading(false);
    }
  }, [sharedVideos, videos.length]);

  // ── fetch videos（sharedVideos がない場合のフォールバック）──────────────
  useEffect(() => {
    if (!channelId || !uploadsPlaylistId) return;
    if (sharedVideos?.length) return;
    const params = new URLSearchParams({ channelId, uploadsPlaylistId });
    fetch(`/api/youtube/videos?${params}`)
      .then((r) => r.json())
      .then((d) => { if (d.videos) setVideos(d.videos); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [channelId, uploadsPlaylistId, sharedVideos?.length]);

  // ── fetch analytics ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!videos.length) return;
    const params = new URLSearchParams({ channelId, videoIds: videos.map((v) => v.id).join(",") });
    fetch(`/api/youtube/analytics?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.analytics) return;
        const map = new Map(d.analytics.map((a: { videoId: string; avgViewPercent: number | null }) => [a.videoId, a]));
        setVideos((prev) =>
          prev.map((v) => {
            const a = map.get(v.id) as { avgViewPercent: number | null } | undefined;
            return a ? { ...v, avgViewPercent: a.avgViewPercent } : v;
          })
        );
      })
      .catch(() => {});
  }, [videos.length, channelId, sharedVideos?.length]);

  // ── fetch manual CTR ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!videos.length) return;
    const params = new URLSearchParams({ channelId, videoIds: videos.map((v) => v.id).join(",") });
    fetch(`/api/youtube/manual-ctr?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.manual) {
          setManualCtrMap(new Map((d.manual as ManualCtrData[]).map((m) => [m.videoId, m])));
        }
      })
      .catch(() => {});
  }, [videos.length, channelId]);

  // ── fetch timeseries（初速データ）50本ずつ分割 ──────────────────────────
  useEffect(() => {
    if (!videos.length) return;
    const videoList = videos.map((v) => ({ id: v.id, publishedAt: v.publishedAt }));
    const CHUNK = 50;
    const chunks: { id: string; publishedAt: string }[][] = [];
    for (let i = 0; i < videoList.length; i += CHUNK) {
      chunks.push(videoList.slice(i, i + CHUNK));
    }
    Promise.all(
      chunks.map((chunk) => {
        const params = new URLSearchParams({ channelId, videos: JSON.stringify(chunk) });
        return fetch(`/api/youtube/kv-timeseries?${params}`)
          .then((r) => r.json())
          .then((d) => d.timeseries as TimeseriesData[] ?? [])
          .catch(() => [] as TimeseriesData[]);
      })
    ).then((results) => {
      const all = results.flat();
      setTimeseriesMap(new Map(all.map((t) => [t.videoId, t])));
    });
  }, [videos.length, channelId]);

  // ── derived data ──────────────────────────────────────────────────────────
  const filteredVideos = useMemo(() => {
    if (typeTab === "long")  return videos.filter((v) => v.isShort !== true);
    if (typeTab === "short") return videos.filter((v) => v.isShort === true);
    return videos;
  }, [videos, typeTab]);

  const { avgCtr, avgRet, avgViews1d } = useMemo(() => {
    const withCtr = filteredVideos.filter((v) => manualCtrMap.get(v.id)?.ctr != null);
    const withRet = filteredVideos.filter((v) => v.avgViewPercent != null);
    const with1d  = filteredVideos.filter((v) => (timeseriesMap.get(v.id)?.views1d ?? null) != null);

    const avgCtr = withCtr.length
      ? withCtr.reduce((s, v) => s + (manualCtrMap.get(v.id)?.ctr ?? 0), 0) / withCtr.length : 5;
    const avgRet = withRet.length
      ? withRet.reduce((s, v) => s + (v.avgViewPercent ?? 0), 0) / withRet.length : 35;
    const avgViews1d = with1d.length
      ? with1d.reduce((s, v) => s + (timeseriesMap.get(v.id)?.views1d ?? 0), 0) / with1d.length : null;

    return { avgCtr, avgRet, avgViews1d };
  }, [filteredVideos, manualCtrMap, timeseriesMap]);

  type EnrichedVideo = Video & {
    ctrVal: number | null;
    retVal: number | null;
    views1d: number | null;
    velocityRatio: number | null;
    diagnosis: Diagnosis;
  };

  const enriched: EnrichedVideo[] = useMemo(() =>
    filteredVideos.map((v) => {
      const ctrVal = manualCtrMap.get(v.id)?.ctr ?? null;
      const retVal = v.avgViewPercent ?? null;
      const views1d = timeseriesMap.get(v.id)?.views1d ?? null;
      const velocityRatio = (views1d != null && avgViews1d != null && avgViews1d > 0)
        ? views1d / avgViews1d : null;
      const diagnosis = getDiagnosis(ctrVal, retVal, velocityRatio, avgCtr, avgRet);
      return { ...v, ctrVal, retVal, views1d, velocityRatio, diagnosis };
    }),
  [filteredVideos, manualCtrMap, timeseriesMap, avgCtr, avgRet, avgViews1d]);

  const sorted: EnrichedVideo[] = useMemo(() => {
    const priority: Record<Diagnosis, number> = { all: 0, thumbnail: 1, content: 2, velocity: 3, win: 4 };
    return [...enriched].sort((a, b) => {
      if (sortMode === "priority")  return priority[a.diagnosis] - priority[b.diagnosis];
      if (sortMode === "ctr")       return (a.ctrVal ?? 99) - (b.ctrVal ?? 99);
      if (sortMode === "retention") return (a.retVal ?? 99) - (b.retVal ?? 99);
      if (sortMode === "velocity")  return (a.velocityRatio ?? 99) - (b.velocityRatio ?? 99);
      return Number(b.viewCount) - Number(a.viewCount);
    });
  }, [enriched, sortMode]);

  // 診断別本数
  const diagCounts = useMemo(() =>
    (["win", "velocity", "thumbnail", "content", "all"] as Diagnosis[]).reduce<Record<Diagnosis, number>>(
      (acc, d) => { acc[d] = enriched.filter((v) => v.diagnosis === d).length; return acc; },
      { win: 0, velocity: 0, thumbnail: 0, content: 0, all: 0 }
    ),
  [enriched]);

  // scatter plot
  const maxViews = useMemo(() => Math.max(...enriched.map((v) => Number(v.viewCount)), 1), [enriched]);
  const CTR_MIN = 0, CTR_MAX = 12, RET_MIN = 10, RET_MAX = 60;
  function scatterX(ctr: number) { return 5 + ((ctr - CTR_MIN) / (CTR_MAX - CTR_MIN)) * 90; }
  function scatterY(ret: number) { return 5 + (1 - (ret - RET_MIN) / (RET_MAX - RET_MIN)) * 90; }
  function dotSize(views: number) { return 10 + (views / maxViews) * 22; }

  // copy prompt
  const copyPrompt = useMemo(() => {
    const lines: string[] = [
      "━━━ チャンネル ボトルネック分析データ ━━━",
      `対象: ${filteredVideos.length}本 (${typeTab === "all" ? "全動画" : typeTab === "long" ? "長尺" : "ショート"})`,
      `チャンネル平均CTR: ${avgCtr.toFixed(1)}%`,
      `チャンネル平均視聴維持率: ${avgRet.toFixed(1)}%`,
      avgViews1d != null ? `チャンネル平均初速（1日後）: ${Math.round(avgViews1d).toLocaleString()}再生` : "",
      "",
    ];
    (["all", "velocity", "thumbnail", "content", "win"] as Diagnosis[]).forEach((d) => {
      const group = sorted.filter((v) => v.diagnosis === d);
      if (!group.length) return;
      lines.push(`【${DIAG_CONFIG[d].emoji} ${DIAG_CONFIG[d].label}（${group.length}本）】`);
      group.forEach((v) => {
        lines.push(`・「${v.title}」`);
        const vel = v.velocityRatio != null ? ` / 初速比 ${(v.velocityRatio * 100).toFixed(0)}%` : "";
        lines.push(`  CTR ${v.ctrVal != null ? v.ctrVal.toFixed(1) + "%" : "—"} / 維持率 ${v.retVal != null ? v.retVal.toFixed(1) + "%" : "—"}${vel} / 再生数 ${Number(v.viewCount).toLocaleString()}`);
      });
      lines.push("");
    });
    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("上記データをもとに、各グループの共通点と具体的な改善アドバイスを教えてください。");
    return lines.join("\n");
  }, [sorted, filteredVideos.length, typeTab, avgCtr, avgRet, avgViews1d]);

  async function handleCopy() {
    try { await navigator.clipboard.writeText(copyPrompt); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = copyPrompt;
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const selectedVideo = useMemo(
    () => enriched.find((v) => v.id === selectedVideoId) ?? null,
    [enriched, selectedVideoId]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-red-500 mr-3" />
        データを取得中...
      </div>
    );
  }

  return (
    <div>
      {/* type tabs */}
      <div className="flex gap-2 mb-6">
        {(["all", "long", "short"] as VideoTypeTab[]).map((t) => (
          <button key={t} onClick={() => setTypeTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              typeTab === t ? "bg-red-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
            }`}>
            {t === "all" ? "すべて" : t === "long" ? "長尺" : "ショート"}
          </button>
        ))}
      </div>

      {/* ── チャンネル全体サマリー ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <p className="text-sm font-semibold text-gray-300 mb-4">チャンネル全体のボトルネック分布</p>
        <div className="space-y-2.5">
          {(["all", "velocity", "thumbnail", "content", "win"] as Diagnosis[]).map((d) => {
            const count = diagCounts[d];
            const pct = enriched.length > 0 ? (count / enriched.length) * 100 : 0;
            const cfg = DIAG_CONFIG[d];
            return (
              <div key={d} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-24 flex-shrink-0">{cfg.emoji} {cfg.label}</span>
                <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{ width: `${pct}%`, background: cfg.color }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-12 text-right flex-shrink-0">
                  {count}本 ({pct.toFixed(0)}%)
                </span>
              </div>
            );
          })}
        </div>

        {/* チャンネル全体の示唆 */}
        {(() => {
          const top = (["all", "velocity", "thumbnail", "content"] as Diagnosis[])
            .reduce((a, b) => diagCounts[a] >= diagCounts[b] ? a : b);
          const hints: Record<Diagnosis, string> = {
            all:       "全体的にテーマ選定の見直しが最優先です。どんな人に何を届けるかを再整理しましょう。",
            velocity:  "コンテンツ品質は高いチャンネルです。投稿直後の告知強化で再生数が伸びる可能性があります。",
            thumbnail: "動画内容は良質です。サムネイルとタイトルの改善が最も即効性のある施策です。",
            content:   "サムネは機能しています。冒頭の掴みと動画構成の改善に集中しましょう。",
            win:       "勝ちパターンが多い優秀なチャンネルです。このフォーマットを横展開してください。",
          };
          if (diagCounts[top] === 0) return null;
          return (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <p className="text-xs text-gray-500">
                <span className="text-gray-300 font-medium">チャンネルの主なボトルネック：{DIAG_CONFIG[top].label}</span>
                　{hints[top]}
              </p>
            </div>
          );
        })()}
      </div>

      {/* summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">平均 CTR</p>
          <p className="text-xl font-bold text-amber-400">{avgCtr.toFixed(1)}%</p>
          <p className="text-xs text-gray-600 mt-1">目安 4〜6%</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">平均 視聴維持率</p>
          <p className="text-xl font-bold text-amber-400">{avgRet.toFixed(1)}%</p>
          <p className="text-xs text-gray-600 mt-1">目安 35〜45%</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">平均 初速（1日後）</p>
          <p className="text-xl font-bold text-violet-400">
            {avgViews1d != null ? `${Math.round(avgViews1d).toLocaleString()}` : "—"}
          </p>
          <p className="text-xs text-gray-600 mt-1">再生数</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">勝ちパターン</p>
          <p className="text-xl font-bold text-emerald-400">{diagCounts.win}本</p>
          <p className="text-xs text-gray-600 mt-1">/ {enriched.length}本中</p>
        </div>
      </div>

      {/* scatter plot */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-gray-300">CTR × 視聴維持率 マップ</p>
          <p className="text-xs text-gray-600">点の大きさ = 再生数</p>
        </div>
        <div className="relative w-full rounded-lg overflow-hidden" style={{ aspectRatio: "16/9", background: "#0d1117" }}>
          {[
            { cls: "top-0 left-0",    color: DIAG_CONFIG.thumbnail.bg, label: "サムネ改善",   lc: "#fbbf24" },
            { cls: "top-0 right-0",   color: DIAG_CONFIG.win.bg,       label: "勝ちパターン", lc: "#34d399" },
            { cls: "bottom-0 left-0", color: DIAG_CONFIG.all.bg,       label: "全面見直し",   lc: "#f87171" },
            { cls: "bottom-0 right-0",color: DIAG_CONFIG.content.bg,   label: "内容改善",     lc: "#60a5fa" },
          ].map((q) => (
            <div key={q.label} className={`absolute w-1/2 h-1/2 flex items-center justify-center text-xs font-semibold ${q.cls}`}
              style={{ background: q.color, color: q.lc, opacity: 0.9 }}>
              <span style={{ opacity: 0.5 }}>{q.label}</span>
            </div>
          ))}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gray-700/50" />
            <div className="absolute left-0 right-0 top-1/2 h-px bg-gray-700/50" />
          </div>
          <span className="absolute top-1.5 left-1/2 -translate-x-1/2 text-[10px] text-gray-600">維持率 高</span>
          <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] text-gray-600">維持率 低</span>
          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-600" style={{ writingMode: "vertical-rl", transform: "translateY(-50%) rotate(180deg)" }}>CTR 低</span>
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-600" style={{ writingMode: "vertical-rl" }}>CTR 高</span>
          {enriched.map((v) => {
            if (v.ctrVal == null || v.retVal == null) return null;
            const x = scatterX(v.ctrVal), y = scatterY(v.retVal);
            const size = dotSize(Number(v.viewCount));
            const color = DIAG_CONFIG[v.diagnosis].color;
            const isHover = hoveredId === v.id;
            return (
              <div key={v.id}
                onMouseEnter={() => setHoveredId(v.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => setSelectedVideoId(v.id)}
                style={{
                  position: "absolute", left: `${x}%`, top: `${y}%`,
                  width: size, height: size,
                  transform: `translate(-50%, -50%) scale(${isHover ? 1.4 : 1})`,
                  background: color, borderRadius: "50%", opacity: 0.85,
                  cursor: "pointer", zIndex: isHover ? 20 : 1, transition: "transform .15s",
                }}>
                {isHover && (
                  <div style={{
                    position: "absolute", bottom: "calc(100% + 8px)", left: "50%",
                    transform: "translateX(-50%)", background: "#1f2937",
                    border: "1px solid #374151", borderRadius: 8, padding: "8px 10px",
                    width: 180, zIndex: 30, pointerEvents: "none",
                  }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "#e5e7eb", marginBottom: 4, lineHeight: 1.4 }}
                       className="line-clamp-2">{v.title}</p>
                    {[["CTR", v.ctrVal?.toFixed(1) + "%"], ["維持率", v.retVal?.toFixed(1) + "%"],
                      ["初速比", v.velocityRatio != null ? (v.velocityRatio * 100).toFixed(0) + "%" : "—"],
                      ["再生数", Number(v.viewCount).toLocaleString()]].map(([k, val]) => (
                      <div key={k} style={{ fontSize: 10, color: "#9ca3af", display: "flex", justifyContent: "space-between" }}>
                        <span>{k}</span><span>{val}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {enriched.filter((v) => v.ctrVal != null && v.retVal != null).length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-gray-600 text-center">
                CTR・維持率データがありません<br />
                <span className="text-xs">動画詳細パネルからCTRを入力してください</span>
              </p>
            </div>
          )}
        </div>
        <div className="flex gap-5 flex-wrap mt-3">
          {(["win", "velocity", "thumbnail", "content", "all"] as Diagnosis[]).map((d) => (
            <div key={d} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: DIAG_CONFIG[d].color }} />
              <span className="text-xs text-gray-500">{DIAG_CONFIG[d].label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* sort + copy bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2 flex-wrap">
          {([
            ["priority",  "改善優先度順"],
            ["ctr",       "CTR低い順"],
            ["retention", "維持率低い順"],
            ["velocity",  "初速低い順"],
            ["views",     "再生数順"],
          ] as [SortMode, string][]).map(([mode, label]) => (
            <button key={mode} onClick={() => setSortMode(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                sortMode === mode ? "bg-gray-700 text-white border-gray-600" : "bg-transparent text-gray-500 border-transparent hover:text-gray-300"
              }`}>
              {label}
            </button>
          ))}
        </div>
        <button onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:text-white hover:border-gray-500 transition-colors">
          <span>📋</span> Claude / GPT に投げる
        </button>
      </div>

      {/* video table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="grid gap-0 px-4 py-2.5 border-b border-gray-800 text-xs text-gray-500"
             style={{ gridTemplateColumns: "minmax(0,2fr) 80px 80px 80px 90px 110px" }}>
          <span>動画</span>
          <span className="text-right">再生数</span>
          <span className="text-right">CTR</span>
          <span className="text-right">維持率</span>
          <span className="text-right">初速</span>
          <span className="text-right">診断</span>
        </div>
        {sorted.length === 0 && (
          <p className="text-center text-sm text-gray-600 py-10">動画が見つかりません</p>
        )}
        {sorted.map((v) => {
          const dc = DIAG_CONFIG[v.diagnosis];
          const isSelected = selectedVideoId === v.id;
          return (
            <div key={v.id}>
              <div
                onClick={() => setSelectedVideoId(isSelected ? null : v.id)}
                className={`grid gap-0 px-4 py-3 border-b border-gray-800/50 items-center cursor-pointer transition-colors ${
                  isSelected ? "bg-gray-800" : "hover:bg-gray-800/40"
                }`}
                style={{ gridTemplateColumns: "minmax(0,2fr) 80px 80px 80px 90px 110px" }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img src={v.thumbnail} alt={v.title} className="w-14 h-8 object-cover rounded flex-shrink-0" />
                  <p className="text-sm text-gray-200 leading-snug line-clamp-2">{v.title}</p>
                </div>
                <p className="text-sm text-right text-gray-400">{Number(v.viewCount).toLocaleString()}</p>
                <p className={`text-sm text-right font-medium ${
                  v.ctrVal == null ? "text-gray-600" : v.ctrVal >= avgCtr ? "text-emerald-400" : "text-red-400"
                }`}>{v.ctrVal != null ? `${v.ctrVal.toFixed(1)}%` : "—"}</p>
                <p className={`text-sm text-right font-medium ${
                  v.retVal == null ? "text-gray-600" : v.retVal >= avgRet ? "text-emerald-400" : "text-red-400"
                }`}>{v.retVal != null ? `${v.retVal.toFixed(1)}%` : "—"}</p>
                <p className={`text-sm text-right font-medium ${
                  v.velocityRatio == null ? "text-gray-600"
                  : v.velocityRatio >= 1.0 ? "text-emerald-400"
                  : v.velocityRatio >= 0.7 ? "text-amber-400" : "text-red-400"
                }`}>
                  {v.velocityRatio != null ? `${(v.velocityRatio * 100).toFixed(0)}%` : "—"}
                </p>
                <div className="flex justify-end">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${dc.pill}`}>{dc.pillText}</span>
                </div>
              </div>

              {/* 動画別詳細パネル */}
              {isSelected && (
                <div className="border-b border-gray-800/50 bg-gray-950 px-5 py-4">
                  <p className="text-xs font-semibold text-gray-400 mb-3">ファネル診断</p>

                  {/* ファネル */}
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {[
                      {
                        step: "① 露出",
                        value: "データなし",
                        note: "インプレッション数はAPIで取得困難",
                        status: "neutral" as const,
                      },
                      {
                        step: "② クリック (CTR)",
                        value: v.ctrVal != null ? `${v.ctrVal.toFixed(1)}%` : "未入力",
                        note: v.ctrVal != null
                          ? v.ctrVal >= avgCtr ? `✅ チャンネル平均（${avgCtr.toFixed(1)}%）以上` : `⚠️ チャンネル平均（${avgCtr.toFixed(1)}%）未満`
                          : "手動入力で確認できます",
                        status: v.ctrVal == null ? "neutral" as const : v.ctrVal >= avgCtr ? "good" as const : "bad" as const,
                      },
                      {
                        step: "③ 視聴（維持率）",
                        value: v.retVal != null ? `${v.retVal.toFixed(1)}%` : "—",
                        note: v.retVal != null
                          ? v.retVal >= avgRet ? `✅ チャンネル平均（${avgRet.toFixed(1)}%）以上` : `⚠️ チャンネル平均（${avgRet.toFixed(1)}%）未満`
                          : "取得中...",
                        status: v.retVal == null ? "neutral" as const : v.retVal >= avgRet ? "good" as const : "bad" as const,
                      },
                      {
                        step: "④ 初速（1日後）",
                        value: v.views1d != null ? `${v.views1d.toLocaleString()}再生` : "記録なし",
                        note: v.velocityRatio != null
                          ? v.velocityRatio >= 1.0
                            ? `✅ 平均の${(v.velocityRatio * 100).toFixed(0)}%（平均超え）`
                            : `⚠️ 平均の${(v.velocityRatio * 100).toFixed(0)}%（平均未満）`
                          : avgViews1d != null ? "スナップショット未記録" : "初速データ蓄積中",
                        status: v.velocityRatio == null ? "neutral" as const : v.velocityRatio >= 1.0 ? "good" as const : "bad" as const,
                      },
                    ].map((f) => (
                      <div key={f.step} className={`rounded-lg p-3 border ${
                        f.status === "good" ? "border-emerald-800/50 bg-emerald-950/30"
                        : f.status === "bad" ? "border-red-800/50 bg-red-950/30"
                        : "border-gray-800 bg-gray-900"
                      }`}>
                        <p className="text-xs text-gray-500 mb-1">{f.step}</p>
                        <p className={`text-base font-bold mb-1 ${
                          f.status === "good" ? "text-emerald-400"
                          : f.status === "bad" ? "text-red-400"
                          : "text-gray-500"
                        }`}>{f.value}</p>
                        <p className="text-xs text-gray-600 leading-snug">{f.note}</p>
                      </div>
                    ))}
                  </div>

                  {/* 診断結果 + 改善提案 */}
                  <div className={`rounded-lg p-4 flex gap-3 items-start`} style={{ background: dc.bg, border: `1px solid ${dc.color}30` }}>
                    <span className="text-2xl">{dc.emoji}</span>
                    <div>
                      <p className="text-sm font-bold mb-1" style={{ color: dc.color }}>{dc.label}</p>
                      <p className="text-xs text-gray-400 leading-relaxed">{dc.advice}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* copy modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-white mb-1">Claude / GPT に投げる</h3>
            <p className="text-xs text-gray-500 mb-3">コピーして Claude や ChatGPT に貼り付けると改善アドバイスが得られます</p>
            <textarea
              className="w-full h-64 bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs text-gray-300 font-mono resize-none outline-none leading-relaxed"
              readOnly value={copyPrompt} />
            {copied && <p className="text-xs text-emerald-400 mt-2 text-right">コピーしました！</p>}
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 bg-gray-800 text-gray-400 rounded-lg text-sm">閉じる</button>
              <button onClick={handleCopy} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-semibold transition-colors">コピーする</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
