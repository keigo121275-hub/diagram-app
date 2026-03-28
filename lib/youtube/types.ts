/** KV スナップショット由来の初速再生数 */
export type VideoTimeseries = {
  videoId: string;
  views1d: number | null;
  views3d: number | null;
  views7d: number | null;
  views30d: number | null;
};

/** Reporting API 由来（ctr は 0〜1 の小数） */
export type VideoReportingCtr = {
  videoId: string;
  impressions: number | null;
  ctr: number | null;
  date: string | null;
};

/** 手動入力 CTR（ctr は 0〜100 の %） */
export type ManualCtrData = {
  videoId: string;
  impressions: number | null;
  ctr: number | null;
  updatedAt: string | null;
  sources?: { name: string; impressions: number | null; ctr: number | null }[];
};

export type VideoAnalyticsAvgRow = {
  videoId: string;
  avgViewPercent: number | null;
};

export type TimeTab = "lifetime" | "1d" | "3d" | "7d" | "30d";

export type YoutubeDurationFilterTab = "all" | "short" | "long";

export type BottleneckSortMode = "priority" | "ctr" | "retention" | "views";

export type BottleneckQuadrant = "win" | "thumbnail" | "content" | "all";
