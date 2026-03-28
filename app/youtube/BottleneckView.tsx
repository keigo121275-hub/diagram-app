"use client";

import { useEffect, useMemo, useState } from "react";
import { Video } from "@/lib/types";

type ManualCtrData = {
  videoId: string;
  impressions: number | null;
  ctr: number | null;
  updatedAt: string | null;
  sources?: { name: string; impressions: number | null; ctr: number | null }[];
};

type SortMode = "priority" | "ctr" | "retention" | "views";
type VideoTypeTab = "all" | "long" | "short";
type Quadrant = "win" | "thumbnail" | "content" | "all";

const QUAD_CONFIG: Record<Quadrant, { label: string; color: string; bg: string; pill: string; pillText: string }> = {
  win:       { label: "勝ちパターン",  color: "#34d399", bg: "rgba(52,211,153,.07)",  pill: "bg-emerald-500/15 text-emerald-400", pillText: "勝ちパターン" },
  thumbnail: { label: "サムネ改善",    color: "#fbbf24", bg: "rgba(251,191,36,.06)",  pill: "bg-amber-500/15 text-amber-400",    pillText: "サムネ改善" },
  content:   { label: "内容改善",      color: "#60a5fa", bg: "rgba(96,165,250,.06)",  pill: "bg-blue-500/15 text-blue-400",      pillText: "内容改善" },
  all:       { label: "全面見直し",    color: "#f87171", bg: "rgba(239,68,68,.06)",   pill: "bg-red-500/15 text-red-400",        pillText: "全面見直し" },
};

function getQuadrant(ctr: number | null, ret: number | null, avgCtr: number, avgRet: number): Quadrant {
  if (ctr == null || ret == null) return "all";
  const hCtr = ctr >= avgCtr;
  const hRet = ret >= avgRet;
  if ( hCtr &&  hRet) return "win";
  if (!hCtr &&  hRet) return "thumbnail";
  if ( hCtr && !hRet) return "content";
  return "all";
}

type Props = { channelId: string; uploadsPlaylistId: string; sharedVideos?: Video[] };

export default function BottleneckView({ channelId, uploadsPlaylistId, sharedVideos }: Props) {
  const [videos, setVideos] = useState<Video[]>(sharedVideos ?? []);
  const [loading, setLoading] = useState(!(sharedVideos?.length));
  const [manualCtrMap, setManualCtrMap] = useState<Map<string, ManualCtrData>>(new Map());
  const [sortMode, setSortMode] = useState<SortMode>("priority");
  const [typeTab, setTypeTab] = useState<VideoTypeTab>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // sharedVideos が後から届いた場合（BottleneckView が先にマウントされたケース）に同期
  useEffect(() => {
    if (sharedVideos?.length && videos.length === 0) {
      setVideos(sharedVideos);
      setLoading(false);
    }
  }, [sharedVideos, videos.length]);

  // ── fetch videos（sharedVideos がない場合のフォールバック）──────────────────
  useEffect(() => {
    if (!channelId || !uploadsPlaylistId) return;
    if (sharedVideos?.length) return; // 親から渡されていればスキップ
    const params = new URLSearchParams({ channelId, uploadsPlaylistId });
    fetch(`/api/youtube/videos?${params}`)
      .then((r) => r.json())
      .then((d) => { if (d.videos) setVideos(d.videos); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [channelId, uploadsPlaylistId, sharedVideos?.length]);

  // ── fetch analytics（sharedVideos がない場合のフォールバック）────────────────
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

  // ── derived data ──────────────────────────────────────────────────────────
  const filteredVideos = useMemo(() => {
    if (typeTab === "long")  return videos.filter((v) => v.isShort !== true);
    if (typeTab === "short") return videos.filter((v) => v.isShort === true);
    return videos;
  }, [videos, typeTab]);

  const { avgCtr, avgRet } = useMemo(() => {
    const withCtr = filteredVideos.filter((v) => {
      const m = manualCtrMap.get(v.id);
      return m?.ctr != null;
    });
    const withRet = filteredVideos.filter((v) => v.avgViewPercent != null);
    const avgCtr = withCtr.length
      ? withCtr.reduce((s, v) => s + (manualCtrMap.get(v.id)?.ctr ?? 0), 0) / withCtr.length
      : 5;
    const avgRet = withRet.length
      ? withRet.reduce((s, v) => s + (v.avgViewPercent ?? 0), 0) / withRet.length
      : 35;
    return { avgCtr, avgRet };
  }, [filteredVideos, manualCtrMap]);

  type EnrichedVideo = Video & { ctrVal: number | null; retVal: number | null; quad: Quadrant };

  const enriched: EnrichedVideo[] = useMemo(() =>
    filteredVideos.map((v) => {
      const m = manualCtrMap.get(v.id);
      const ctrVal = m?.ctr ?? null;
      const retVal = v.avgViewPercent ?? null;
      return { ...v, ctrVal, retVal, quad: getQuadrant(ctrVal, retVal, avgCtr, avgRet) };
    }),
  [filteredVideos, manualCtrMap, avgCtr, avgRet]);

  const sorted: EnrichedVideo[] = useMemo(() => {
    const priority: Record<Quadrant, number> = { all: 0, thumbnail: 1, content: 2, win: 3 };
    return [...enriched].sort((a, b) => {
      if (sortMode === "priority")   return priority[a.quad] - priority[b.quad];
      if (sortMode === "ctr")        return (a.ctrVal ?? 99) - (b.ctrVal ?? 99);
      if (sortMode === "retention")  return (a.retVal ?? 99) - (b.retVal ?? 99);
      return Number(b.viewCount) - Number(a.viewCount);
    });
  }, [enriched, sortMode]);

  // scatter plot range
  const maxViews = useMemo(() => Math.max(...enriched.map((v) => Number(v.viewCount)), 1), [enriched]);
  const CTR_MIN = 0, CTR_MAX = 12, RET_MIN = 10, RET_MAX = 60;
  function scatterX(ctr: number) { return 5 + ((ctr - CTR_MIN) / (CTR_MAX - CTR_MIN)) * 90; }
  function scatterY(ret: number) { return 5 + (1 - (ret - RET_MIN) / (RET_MAX - RET_MIN)) * 90; }
  function dotSize(views: number) { return 10 + (views / maxViews) * 22; }

  // quad counts
  const quadCounts = useMemo(() =>
    (["win", "thumbnail", "content", "all"] as Quadrant[]).reduce<Record<Quadrant, number>>(
      (acc, q) => { acc[q] = enriched.filter((v) => v.quad === q).length; return acc; },
      { win: 0, thumbnail: 0, content: 0, all: 0 }
    ),
  [enriched]);

  // copy prompt
  const copyPrompt = useMemo(() => {
    const lines: string[] = [
      "━━━ チャンネル ボトルネック分析データ ━━━",
      `対象: ${filteredVideos.length}本 (${typeTab === "all" ? "全動画" : typeTab === "long" ? "長尺" : "ショート"})`,
      `チャンネル平均CTR: ${avgCtr.toFixed(1)}%`,
      `チャンネル平均視聴維持率: ${avgRet.toFixed(1)}%`,
      "",
    ];
    (["all", "thumbnail", "content", "win"] as Quadrant[]).forEach((q) => {
      const group = sorted.filter((v) => v.quad === q);
      if (!group.length) return;
      lines.push(`【${QUAD_CONFIG[q].label}（${group.length}本）】`);
      group.forEach((v) => {
        lines.push(`・「${v.title}」`);
        lines.push(`  CTR ${v.ctrVal != null ? v.ctrVal.toFixed(1) + "%" : "—"} / 維持率 ${v.retVal != null ? v.retVal.toFixed(1) + "%" : "—"} / 再生数 ${Number(v.viewCount).toLocaleString()}`);
      });
      lines.push("");
    });
    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("上記データをもとに、各グループの動画の共通点と改善アドバイスを具体的に教えてください。");
    lines.push("特に「全面見直し」と「サムネ改善」グループを優先してください。");
    return lines.join("\n");
  }, [sorted, filteredVideos.length, typeTab, avgCtr, avgRet]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(copyPrompt);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = copyPrompt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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
          <button
            key={t}
            onClick={() => setTypeTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              typeTab === t ? "bg-red-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {t === "all" ? "すべて" : t === "long" ? "長尺" : "ショート"}
          </button>
        ))}
      </div>

      {/* summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 sm:p-4">
          <p className="text-xs text-gray-500 mb-1">平均 CTR</p>
          <p className="text-xl font-bold text-amber-400">{avgCtr.toFixed(1)}%</p>
          <p className="text-xs text-gray-600 mt-1">業界目安 4〜6%</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 sm:p-4">
          <p className="text-xs text-gray-500 mb-1">平均 視聴維持率</p>
          <p className="text-xl font-bold text-amber-400">{avgRet.toFixed(1)}%</p>
          <p className="text-xs text-gray-600 mt-1">業界目安 35〜45%</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 sm:p-4">
          <p className="text-xs text-gray-500 mb-1">改善優先度 高</p>
          <p className="text-xl font-bold text-red-400">{quadCounts.all}本</p>
          <p className="text-xs text-gray-600 mt-1">CTR・維持率 両方低</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 sm:p-4">
          <p className="text-xs text-gray-500 mb-1">勝ちパターン</p>
          <p className="text-xl font-bold text-emerald-400">{quadCounts.win}本</p>
          <p className="text-xs text-gray-600 mt-1">CTR・維持率 両方高</p>
        </div>
      </div>

      {/* scatter plot */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 sm:p-5 mb-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4">
          <p className="text-sm font-semibold text-gray-300">CTR × 視聴維持率 マップ</p>
          <p className="text-[11px] sm:text-xs text-gray-600">各点 = 1動画 ／ 点の大きさ = 再生数</p>
        </div>

        {/* plot area */}
        <div
          className="relative w-full rounded-lg overflow-hidden"
          style={{ aspectRatio: "16/9", background: "#0d1117" }}
        >
          {/* quadrant bg */}
          {[
            { cls: "top-0 left-0",   color: QUAD_CONFIG.thumbnail.bg, label: "サムネ改善",  lc: "#fbbf24" },
            { cls: "top-0 right-0",  color: QUAD_CONFIG.win.bg,       label: "勝ちパターン",lc: "#34d399" },
            { cls: "bottom-0 left-0",color: QUAD_CONFIG.all.bg,       label: "全面見直し",  lc: "#f87171" },
            { cls: "bottom-0 right-0",color: QUAD_CONFIG.content.bg,  label: "内容改善",    lc: "#60a5fa" },
          ].map((q) => (
            <div
              key={q.label}
              className={`absolute w-1/2 h-1/2 flex items-center justify-center text-xs font-semibold ${q.cls}`}
              style={{ background: q.color, color: q.lc, opacity: 0.9 }}
            >
              <span style={{ opacity: 0.5 }}>{q.label}</span>
            </div>
          ))}

          {/* axes */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gray-700/50" />
            <div className="absolute left-0 right-0 top-1/2 h-px bg-gray-700/50" />
          </div>

          {/* axis labels */}
          <span className="absolute top-1.5 left-1/2 -translate-x-1/2 text-[10px] text-gray-600">維持率 高</span>
          <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] text-gray-600">維持率 低</span>
          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-600" style={{ writingMode: "vertical-rl", transform: "translateY(-50%) rotate(180deg)" }}>CTR 低</span>
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-600" style={{ writingMode: "vertical-rl" }}>CTR 高</span>

          {/* dots */}
          {enriched.map((v) => {
            if (v.ctrVal == null || v.retVal == null) return null;
            const x = scatterX(v.ctrVal);
            const y = scatterY(v.retVal);
            const size = dotSize(Number(v.viewCount));
            const color = QUAD_CONFIG[v.quad].color;
            const isHover = hoveredId === v.id;
            return (
              <div
                key={v.id}
                onMouseEnter={() => setHoveredId(v.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  position: "absolute",
                  left: `${x}%`,
                  top: `${y}%`,
                  width: size,
                  height: size,
                  transform: `translate(-50%, -50%) scale(${isHover ? 1.4 : 1})`,
                  background: color,
                  borderRadius: "50%",
                  opacity: 0.85,
                  cursor: "pointer",
                  zIndex: isHover ? 20 : 1,
                  transition: "transform .15s",
                }}
              >
                {isHover && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "calc(100% + 8px)",
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: 8,
                      padding: "8px 10px",
                      width: 170,
                      zIndex: 30,
                      pointerEvents: "none",
                    }}
                  >
                    <p style={{ fontSize: 11, fontWeight: 600, color: "#e5e7eb", marginBottom: 4, lineHeight: 1.4 }}
                       className="line-clamp-2">{v.title}</p>
                    <div style={{ fontSize: 10, color: "#9ca3af", display: "flex", justifyContent: "space-between" }}>
                      <span>CTR</span><span>{v.ctrVal.toFixed(1)}%</span>
                    </div>
                    <div style={{ fontSize: 10, color: "#9ca3af", display: "flex", justifyContent: "space-between" }}>
                      <span>維持率</span><span>{v.retVal.toFixed(1)}%</span>
                    </div>
                    <div style={{ fontSize: 10, color: "#9ca3af", display: "flex", justifyContent: "space-between" }}>
                      <span>再生数</span><span>{Number(v.viewCount).toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* no data msg */}
          {enriched.filter((v) => v.ctrVal != null && v.retVal != null).length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-gray-600 text-center">
                CTR・維持率データがありません
                <br />
                <span className="text-xs">動画詳細パネルからスクショ取り込みか手動入力をしてください</span>
              </p>
            </div>
          )}
        </div>

        {/* legend */}
        <div className="flex gap-5 flex-wrap mt-3">
          {(["win", "thumbnail", "content", "all"] as Quadrant[]).map((q) => (
            <div key={q} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: QUAD_CONFIG[q].color }} />
              <span className="text-xs text-gray-500">{QUAD_CONFIG[q].label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* sort + copy bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div className="flex gap-1.5 sm:gap-2 flex-wrap">
          {([
            ["priority", "改善優先度順"],
            ["ctr",       "CTR低い順"],
            ["retention", "維持率低い順"],
            ["views",     "再生数順"],
          ] as [SortMode, string][]).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setSortMode(mode)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium border transition-colors ${
                sortMode === mode
                  ? "bg-gray-700 text-white border-gray-600"
                  : "bg-transparent text-gray-500 border-transparent hover:text-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-xs sm:text-sm text-gray-300 hover:text-white hover:border-gray-500 transition-colors w-full sm:w-auto flex-shrink-0"
        >
          <span>📋</span> Claude / GPT に投げる
        </button>
      </div>

      {/* video table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden overflow-x-auto touch-pan-x">
        {/* thead */}
        <div
          className="grid gap-0 px-3 sm:px-4 py-2.5 border-b border-gray-800 text-[11px] sm:text-xs text-gray-500 min-w-[520px]"
          style={{ gridTemplateColumns: "minmax(0,2fr) 72px 72px 72px 100px" }}
        >
          <span>動画</span>
          <span className="text-right">再生数</span>
          <span className="text-right">CTR</span>
          <span className="text-right">維持率</span>
          <span className="text-right">判定</span>
        </div>

        {sorted.length === 0 && (
          <p className="text-center text-sm text-gray-600 py-10">動画が見つかりません</p>
        )}

        {sorted.map((v) => {
          const qc = QUAD_CONFIG[v.quad];
          return (
            <div
              key={v.id}
              className="grid gap-0 px-3 sm:px-4 py-3 border-b border-gray-800/50 last:border-0 items-center hover:bg-gray-800/40 transition-colors min-w-[520px]"
              style={{ gridTemplateColumns: "minmax(0,2fr) 72px 72px 72px 100px" }}
            >
              {/* title + thumb */}
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={v.thumbnail}
                  alt={v.title}
                  className="w-14 h-8 object-cover rounded flex-shrink-0"
                />
                <p className="text-sm text-gray-200 leading-snug line-clamp-2">{v.title}</p>
              </div>

              {/* views */}
              <p className="text-sm text-right text-gray-400">
                {Number(v.viewCount).toLocaleString()}
              </p>

              {/* CTR */}
              <p className={`text-sm text-right font-medium ${
                v.ctrVal == null ? "text-gray-600" :
                v.ctrVal >= avgCtr ? "text-emerald-400" : "text-red-400"
              }`}>
                {v.ctrVal != null ? `${v.ctrVal.toFixed(1)}%` : "—"}
              </p>

              {/* retention */}
              <p className={`text-sm text-right font-medium ${
                v.retVal == null ? "text-gray-600" :
                v.retVal >= avgRet ? "text-emerald-400" : "text-red-400"
              }`}>
                {v.retVal != null ? `${v.retVal.toFixed(1)}%` : "—"}
              </p>

              {/* quadrant pill */}
              <div className="flex justify-end">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${qc.pill}`}>
                  {qc.pillText}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* copy modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[min(90vh,32rem)] overflow-y-auto p-4 sm:p-6 mx-2"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-white mb-1">Claude / GPT に投げる</h3>
            <p className="text-xs text-gray-500 mb-3">
              コピーして Claude や ChatGPT に貼り付けると改善アドバイスが得られます
            </p>
            <textarea
              className="w-full h-64 bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs text-gray-300 font-mono resize-none outline-none leading-relaxed"
              readOnly
              value={copyPrompt}
            />
            {copied && (
              <p className="text-xs text-emerald-400 mt-2 text-right">コピーしました！</p>
            )}
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 bg-gray-800 text-gray-400 rounded-lg text-sm"
              >
                閉じる
              </button>
              <button
                onClick={handleCopy}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                コピーする
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
