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
      part: ["statistics", "snippet"],
      id: videoIds,
    });

    const videos: Video[] = statsRes.data.items?.map((item) => ({
      id: item.id ?? "",
      title: item.snippet?.title ?? "",
      thumbnail:
        item.snippet?.thumbnails?.medium?.url ??
        item.snippet?.thumbnails?.default?.url ??
        "",
      publishedAt: item.snippet?.publishedAt ?? "",
      viewCount: item.statistics?.viewCount ?? "0",
      likeCount: item.statistics?.likeCount ?? "0",
    })) ?? [];

    return NextResponse.json({ videos });
  } catch (err) {
    console.error("YouTube videos API error:", err);
    return NextResponse.json(
      { error: "YouTube APIの呼び出しに失敗しました" },
      { status: 500 }
    );
  }
}
