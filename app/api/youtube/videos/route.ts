/**
 * 動画一覧を返す。
 *
 * クエリパラメータ:
 *   - channelId: 接続済みチャンネルのID（トークン取得に使用）
 *   - uploadsPlaylistId: 動画を取得するアップロードプレイリストID
 */
import { NextRequest, NextResponse } from "next/server";
import { getYoutubeClient } from "@/lib/getYoutubeClient";
import { Video } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const channelId = searchParams.get("channelId");
  const uploadsPlaylistId = searchParams.get("uploadsPlaylistId");

  if (!channelId || !uploadsPlaylistId) {
    return NextResponse.json(
      { error: "channelId と uploadsPlaylistId が必要です" },
      { status: 400 }
    );
  }

  const youtube = await getYoutubeClient(channelId);
  if (!youtube) {
    return NextResponse.json(
      { error: "チャンネルが未接続です。/youtube/connect から接続してください。" },
      { status: 401 }
    );
  }

  try {
    const playlistRes = await youtube.playlistItems.list({
      part: ["contentDetails"],
      playlistId: uploadsPlaylistId,
      maxResults: 50,
    });

    const videoIds = playlistRes.data.items
      ?.map((item) => item.contentDetails?.videoId)
      .filter(Boolean) as string[];

    if (!videoIds.length) {
      return NextResponse.json({ videos: [] });
    }

    const statsRes = await youtube.videos.list({
      part: ["statistics", "snippet", "contentDetails"],
      id: videoIds,
    });

    /** ISO 8601 duration → 秒数に変換 (例: PT1M30S → 90) */
    function parseDuration(iso: string): number {
      const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!m) return 0;
      return (parseInt(m[1] ?? "0") * 3600) + (parseInt(m[2] ?? "0") * 60) + parseInt(m[3] ?? "0");
    }

    const videos: Video[] = statsRes.data.items?.map((item) => {
      const duration = item.contentDetails?.duration ?? "";
      const durationSec = parseDuration(duration);
      const title = item.snippet?.title ?? "";
      // ショート判定: 3分（180秒）以下
      const isShort = durationSec > 0 && durationSec <= 180;
      return {
        id: item.id ?? "",
        title,
        thumbnail:
          item.snippet?.thumbnails?.medium?.url ??
          item.snippet?.thumbnails?.default?.url ??
          "",
        publishedAt: item.snippet?.publishedAt ?? "",
        viewCount: item.statistics?.viewCount ?? "0",
        likeCount: item.statistics?.likeCount ?? "0",
        duration,
        isShort,
      };
    }) ?? [];

    return NextResponse.json({ videos });
  } catch (err) {
    console.error("YouTube videos API error:", err);
    return NextResponse.json(
      { error: "YouTube APIの呼び出しに失敗しました" },
      { status: 500 }
    );
  }
}
