import fs from "fs";
import path from "path";

const TOKEN_FILE = path.join(process.cwd(), "data", "channel-token.json");

type ChannelToken = {
  refreshToken: string;
  channelName?: string;
  savedAt: string;
};

export function saveChannelToken(data: Omit<ChannelToken, "savedAt">) {
  const token: ChannelToken = { ...data, savedAt: new Date().toISOString() };

  // ローカル環境はファイルに保存
  try {
    const dir = path.dirname(TOKEN_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(token, null, 2));
  } catch {
    // Vercel など書き込み不可の環境ではスキップ
  }
}

export function getChannelToken(): ChannelToken | null {
  // 1. 環境変数を優先（Vercel本番環境）
  if (process.env.CHANNEL_REFRESH_TOKEN) {
    return {
      refreshToken: process.env.CHANNEL_REFRESH_TOKEN,
      channelName: process.env.CHANNEL_NAME ?? "接続済みチャンネル",
      savedAt: new Date().toISOString(),
    };
  }

  // 2. ローカルファイルにフォールバック（開発環境）
  if (!fs.existsSync(TOKEN_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(TOKEN_FILE, "utf-8"));
  } catch {
    return null;
  }
}
