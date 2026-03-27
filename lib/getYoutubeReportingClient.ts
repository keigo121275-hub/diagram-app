/**
 * 指定チャンネルの保存済みリフレッシュトークンを使って
 * YouTube Reporting API v1 クライアントと OAuth2 クライアントを生成する。
 */
import { google } from "googleapis";
import { getChannelToken } from "./channelTokenStore";

export async function getYoutubeReportingClient(channelId: string) {
  const token = await getChannelToken(channelId);
  if (!token) return null;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/youtube/auth/callback`
  );

  oauth2Client.setCredentials({ refresh_token: token.refreshToken });
  const reportingClient = google.youtubereporting({ version: "v1", auth: oauth2Client });

  return { client: reportingClient, oauth2Client };
}
