import { google } from "googleapis";
import { getChannelToken } from "./channelTokenStore";

export async function getYoutubeClient() {
  const token = getChannelToken();
  if (!token) return null;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/youtube/auth/callback`
  );

  oauth2Client.setCredentials({ refresh_token: token.refreshToken });
  return google.youtube({ version: "v3", auth: oauth2Client });
}
