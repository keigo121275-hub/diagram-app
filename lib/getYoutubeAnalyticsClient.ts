/**
 * 指定チャンネルの保存済みリフレッシュトークンを使って
 * YouTube Analytics API クライアントを生成する。
 */
import { google } from "googleapis";
import { getChannelToken } from "./channelTokenStore";

export async function getYoutubeAnalyticsClient(channelId: string) {
  const token = await getChannelToken(channelId);
  if (!token) return null;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/youtube/auth/callback`
  );

  oauth2Client.setCredentials({ refresh_token: token.refreshToken });
  return google.youtubeAnalytics({ version: "v2", auth: oauth2Client });
}
