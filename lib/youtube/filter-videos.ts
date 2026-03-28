import type { Video } from "@/lib/types";
import type { YoutubeDurationFilterTab } from "./types";

export function filterVideosByDurationTab(
  videos: Video[],
  tab: YoutubeDurationFilterTab
): Video[] {
  if (tab === "short") return videos.filter((v) => v.isShort === true);
  if (tab === "long") return videos.filter((v) => v.isShort !== true);
  return videos;
}
