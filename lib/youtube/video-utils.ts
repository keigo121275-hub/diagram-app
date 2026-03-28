import type { Video } from "@/lib/types";
import type { VideoAnalyticsAvgRow } from "./types";

export function dedupeVideosById(videos: Video[]): Video[] {
  const seen = new Set<string>();
  return videos.filter((v) => (seen.has(v.id) ? false : seen.add(v.id) && true));
}

export function mergeAvgViewPercentIntoVideos(
  videos: Video[],
  rows: VideoAnalyticsAvgRow[]
): Video[] {
  const map = new Map(rows.map((a) => [a.videoId, a]));
  return videos.map((v) => {
    const a = map.get(v.id);
    return a ? { ...v, avgViewPercent: a.avgViewPercent } : v;
  });
}

const CACHE_KEY_PREFIX = "yt_videos_cache_v3:";

export const VIDEO_LIST_CACHE_TTL_MS = 30 * 60 * 1000;

export function videoListCacheKey(channelId: string): string {
  return `${CACHE_KEY_PREFIX}${channelId}`;
}

export function readVideoListCache(
  channelId: string
): { videos: Video[]; savedAt: number } | null {
  try {
    const raw = localStorage.getItem(videoListCacheKey(channelId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { videos: Video[]; savedAt: number };
    if (!Array.isArray(parsed.videos) || typeof parsed.savedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeVideoListCache(channelId: string, videos: Video[]): void {
  try {
    localStorage.setItem(
      videoListCacheKey(channelId),
      JSON.stringify({ videos, savedAt: Date.now() })
    );
  } catch {
    /* 容量オーバー等 */
  }
}
