/**
 * OAuth 認証直後のリフレッシュトークンを一時保持する。
 *
 * 用途:
 *   OAuth で取得したトークンは、まず自分所有のチャンネルに紐づけて保存する。
 *   その後、「権限だけ共有されているチャンネル」（YouTubeスタジオで管理者として追加されたチャンネル）
 *   にも接続したい場合、ユーザーがチャンネルIDを手入力して追加できる。
 *   このストアはその際に使う「直近のトークン」を保持するためのもの。
 *
 * 保存先: /data/pending-token.json（ローカルのみ）
 * ライフタイム: 次の OAuth 認証か手動クリアまで保持
 */
import fs from "fs";
import path from "path";

const PENDING_FILE = path.join(process.cwd(), "data", "pending-token.json");

type PendingToken = {
  refreshToken: string;
  savedAt: string;
};

export function savePendingToken(refreshToken: string): void {
  try {
    const dir = path.dirname(PENDING_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const data: PendingToken = { refreshToken, savedAt: new Date().toISOString() };
    fs.writeFileSync(PENDING_FILE, JSON.stringify(data, null, 2));
  } catch {
    // Vercel など書き込み不可の環境ではスキップ（本番はCHANNEL_TOKENSで管理）
  }
}

export function getPendingToken(): PendingToken | null {
  try {
    if (!fs.existsSync(PENDING_FILE)) return null;
    return JSON.parse(fs.readFileSync(PENDING_FILE, "utf-8"));
  } catch {
    return null;
  }
}

export function clearPendingToken(): void {
  try {
    if (fs.existsSync(PENDING_FILE)) fs.unlinkSync(PENDING_FILE);
  } catch {
    // ignore
  }
}
