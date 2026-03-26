import { NextResponse } from "next/server";
import { getYoutubeClient } from "@/lib/getYoutubeClient";

export async function GET() {
  const youtube = await getYoutubeClient();

  if (!youtube) {
    return NextResponse.json(
      { error: "チャンネルが未接続です。/youtube/connect から接続してください。" },
      { status: 401 }
    );
  }

  try {
    const channelRes = await youtube.channels.list({
      part: ["id", "snippet", "contentDetails", "statistics"],
      mine: true,
    });

    const channels = channelRes.data.items?.map((ch) => ({
      id: ch.id ?? "",
      name: ch.snippet?.title ?? "",
      thumbnail: ch.snippet?.thumbnails?.default?.url ?? "",
      subscriberCount: ch.statistics?.subscriberCount ?? "0",
      videoCount: ch.statistics?.videoCount ?? "0",
      uploadsPlaylistId: ch.contentDetails?.relatedPlaylists?.uploads ?? "",
    })) ?? [];

    return NextResponse.json({ channels });
  } catch (err) {
    console.error("YouTube channels API error:", err);
    return NextResponse.json(
      { error: "チャンネル一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}
