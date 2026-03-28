import type { BottleneckQuadrant } from "./types";

export const QUAD_CONFIG: Record<
  BottleneckQuadrant,
  { label: string; color: string; bg: string; pill: string; pillText: string }
> = {
  win: {
    label: "勝ちパターン",
    color: "#34d399",
    bg: "rgba(52,211,153,.07)",
    pill: "bg-emerald-500/15 text-emerald-400",
    pillText: "勝ちパターン",
  },
  thumbnail: {
    label: "サムネ改善",
    color: "#fbbf24",
    bg: "rgba(251,191,36,.06)",
    pill: "bg-amber-500/15 text-amber-400",
    pillText: "サムネ改善",
  },
  content: {
    label: "内容改善",
    color: "#60a5fa",
    bg: "rgba(96,165,250,.06)",
    pill: "bg-blue-500/15 text-blue-400",
    pillText: "内容改善",
  },
  all: {
    label: "全面見直し",
    color: "#f87171",
    bg: "rgba(239,68,68,.06)",
    pill: "bg-red-500/15 text-red-400",
    pillText: "全面見直し",
  },
};

export function getQuadrant(
  ctr: number | null,
  ret: number | null,
  avgCtr: number,
  avgRet: number
): BottleneckQuadrant {
  if (ctr == null || ret == null) return "all";
  const hCtr = ctr >= avgCtr;
  const hRet = ret >= avgRet;
  if (hCtr && hRet) return "win";
  if (!hCtr && hRet) return "thumbnail";
  if (hCtr && !hRet) return "content";
  return "all";
}
