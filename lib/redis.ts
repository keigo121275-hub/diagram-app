import Redis from "ioredis";

const url = process.env.REDIS_URL;
if (!url) throw new Error("REDIS_URL is not set");

// グローバルキャッシュ（開発環境でホットリロードのたびに接続が増えるのを防ぐ）
const globalForRedis = globalThis as unknown as { redis?: Redis };

if (!globalForRedis.redis) {
  globalForRedis.redis = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
  });
}

const redis = globalForRedis.redis;
export default redis;
