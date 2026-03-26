/**
 * チャンネルの接続を解除する。
 */
import { NextRequest, NextResponse } from "next/server";
import { removeChannelToken } from "@/lib/channelTokenStore";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const channelId = formData.get("channelId");

  if (typeof channelId !== "string" || !channelId) {
    return NextResponse.redirect(new URL("/youtube/connect?error=invalid", request.url));
  }

  await removeChannelToken(channelId);

  return NextResponse.redirect(new URL("/youtube/connect", request.url));
}
