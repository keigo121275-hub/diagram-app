import type { Task } from "@/lib/supabase/types";

// ── 称号システム（EXPゲージの5段階ランク）──────────────────────────────
export const RANK_TIERS = [
  { min: 0,   icon: "🌱", title: "見習い冒険者",  color: "#94a3b8" },
  { min: 25,  icon: "🗺️", title: "一人前の旅人",  color: "#60a5fa" },
  { min: 50,  icon: "⚔️", title: "熟練の探索者", color: "#a78bfa" },
  { min: 75,  icon: "🌟", title: "歴戦の勇者",   color: "#facc15" },
  { min: 100, icon: "👑", title: "伝説の英雄",    color: "#4ade80" },
] as const;

export type RankTier = (typeof RANK_TIERS)[number];

export function getRank(pct: number): RankTier {
  let rank: RankTier = RANK_TIERS[0];
  for (const tier of RANK_TIERS) {
    if (pct >= tier.min) rank = tier;
  }
  return rank;
}

// ── クエストカード用ステータスラベル（TaskDetailPanel 専用）──────────────
export const QUEST_STATUS_LABELS: Record<Task["status"], string> = {
  todo:             "📋 受注待ち",
  in_progress:      "⚔️ 挑戦中",
  pending_approval: "✨ 審判待ち",
  done:             "🏆 達成",
  needs_revision:   "🔄 再挑戦",
};

export const STATUS_LABELS: Record<Task["status"], string> = {
  todo: "未着手",
  in_progress: "進行中",
  pending_approval: "承認待ち",
  done: "完了",
  needs_revision: "要修正",
};

export const STATUS_COLORS: Record<
  Task["status"],
  { bg: string; text: string; border: string }
> = {
  todo: { bg: "#1e2130", text: "#94a3b8", border: "#2e3347" },
  in_progress: { bg: "#0f1e40", text: "#60a5fa", border: "#1e3a8a" },
  pending_approval: { bg: "#2a1f00", text: "#facc15", border: "#713f12" },
  done: { bg: "#052e16", text: "#4ade80", border: "#166534" },
  needs_revision: { bg: "#1f0f0f", text: "#f87171", border: "#7f1d1d" },
};

export const LEVEL_LABELS: Record<"large" | "medium" | "small", string> = {
  large: "大",
  medium: "中",
  small: "小",
};

export const LEVEL_COLORS: Record<
  "large" | "medium" | "small",
  { bg: string; text: string; border: string }
> = {
  large: {
    bg: "rgba(108,99,255,0.15)",
    text: "#6c63ff",
    border: "rgba(108,99,255,0.3)",
  },
  medium: {
    bg: "rgba(96,165,250,0.15)",
    text: "#60a5fa",
    border: "rgba(96,165,250,0.3)",
  },
  small: {
    bg: "rgba(148,163,184,0.15)",
    text: "#94a3b8",
    border: "rgba(148,163,184,0.3)",
  },
};
