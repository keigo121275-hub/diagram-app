/**
 * チャンネルのリフレッシュトークンを管理する。
 *
 * 保存先（環境に応じて自動切替）:
 *   - Vercel 本番: Vercel Blob（BLOB_READ_WRITE_TOKEN が設定されている場合）
 *   - ローカル開発: /data/channel-tokens.json
 *   - 後方互換:    環境変数 CHANNEL_TOKENS / CHANNEL_REFRESH_TOKEN
 */
import fs from "fs";
import path from "path";
import { ChannelToken } from "./types";

const TOKEN_FILE = path.join(process.cwd(), "data", "channel-tokens.json");

// Blob 上のファイルパス（BLOB_READ_WRITE_TOKEN からストアIDを抽出してパスを生成）
function getBlobPathname(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN ?? "";
  // トークン形式: vercel_blob_rw_[storeId]_[random]
  const storeId = token.split("_")[3] ?? "default";
  return `channel-tokens-${storeId}.json`;
}

// ---- Vercel Blob 読み書き（非同期） ----

async function readBlobTokens(): Promise<Record<string, ChannelToken>> {
  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: "channel-tokens-" });
    if (blobs.length === 0) return {};
    // Private ストアのため Authorization ヘッダーを付けてフェッチする
    const res = await fetch(blobs[0].downloadUrl, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN ?? ""}`,
      },
    });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

async function writeBlobTokens(tokens: Record<string, ChannelToken>): Promise<void> {
  const { put } = await import("@vercel/blob");
  await put(getBlobPathname(), JSON.stringify(tokens), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

// ---- ローカルファイル読み書き（同期） ----

function readTokenFile(): Record<string, ChannelToken> {
  try {
    if (!fs.existsSync(TOKEN_FILE)) return {};
    return JSON.parse(fs.readFileSync(TOKEN_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function writeTokenFile(tokens: Record<string, ChannelToken>): void {
  try {
    const dir = path.dirname(TOKEN_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
  } catch {
    // Vercel など書き込み不可の環境ではスキップ
  }
}

// ---- 環境変数からの読み込み（後方互換） ----

function getTokensFromEnv(): Record<string, ChannelToken> {
  if (process.env.CHANNEL_TOKENS) {
    try {
      const list: ChannelToken[] = JSON.parse(process.env.CHANNEL_TOKENS);
      return Object.fromEntries(list.map((t) => [t.channelId, t]));
    } catch {
      return {};
    }
  }
  if (process.env.CHANNEL_REFRESH_TOKEN) {
    const token: ChannelToken = {
      channelId: "env-default",
      channelName: process.env.CHANNEL_NAME ?? "接続済みチャンネル",
      refreshToken: process.env.CHANNEL_REFRESH_TOKEN,
      savedAt: new Date().toISOString(),
    };
    return { "env-default": token };
  }
  return {};
}

const isBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

// ---- 公開 API ----

/**
 * 全チャンネルトークンを返す（非同期）。
 * Blob → 環境変数 → ローカルファイルの優先順で読む。
 */
export async function getAllChannelTokens(): Promise<ChannelToken[]> {
  if (isBlob()) {
    const blobTokens = await readBlobTokens();
    const envTokens = getTokensFromEnv();
    const merged = { ...envTokens, ...blobTokens };
    return Object.values(merged);
  }
  const envTokens = getTokensFromEnv();
  if (Object.keys(envTokens).length > 0) return Object.values(envTokens);
  return Object.values(readTokenFile());
}

/**
 * 指定チャンネルのトークンを取得する（非同期）。
 */
export async function getChannelToken(channelId: string): Promise<ChannelToken | null> {
  const all = await getAllChannelTokens();
  return all.find((t) => t.channelId === channelId) ?? null;
}

/**
 * チャンネルのトークンを保存する（非同期）。
 */
export async function saveChannelToken(
  data: Omit<ChannelToken, "savedAt">
): Promise<void> {
  const token: ChannelToken = { ...data, savedAt: new Date().toISOString() };
  if (isBlob()) {
    const tokens = await readBlobTokens();
    tokens[data.channelId] = token;
    await writeBlobTokens(tokens);
  } else {
    const tokens = readTokenFile();
    tokens[data.channelId] = token;
    writeTokenFile(tokens);
  }
}

/**
 * 指定チャンネルのトークンを削除する（非同期）。
 */
export async function removeChannelToken(channelId: string): Promise<void> {
  if (isBlob()) {
    const tokens = await readBlobTokens();
    delete tokens[channelId];
    await writeBlobTokens(tokens);
  } else {
    const tokens = readTokenFile();
    delete tokens[channelId];
    writeTokenFile(tokens);
  }
}
