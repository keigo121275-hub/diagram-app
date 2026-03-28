/**
 * チャンネルのリフレッシュトークン（1チャンネルに1つ保存）
 */
export type ChannelToken = {
  channelId: string;
  channelName: string;
  refreshToken: string;
  savedAt: string;
};

/**
 * YouTubeチャンネルの表示用データ
 */
export type Channel = {
  id: string;
  name: string;
  thumbnail: string;
  subscriberCount: string;
  videoCount: string;
  uploadsPlaylistId: string;
};

/**
 * 動画の表示用データ
 * analytics フィールドは YouTube Analytics API で別途取得（権限がない場合は undefined）
 */
export type Video = {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  viewCount: string;
  likeCount: string;
  duration?: string;   // ISO 8601 形式 (例: PT1M30S)
  isShort?: boolean;   // 60秒以下なら true
  ctr?: number | null;
  avgViewPercent?: number | null;
};
