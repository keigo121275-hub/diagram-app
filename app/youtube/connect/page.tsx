import { getChannelToken } from "@/lib/channelTokenStore";

type Props = {
  searchParams: Promise<{ success?: string; error?: string; channelName?: string; refreshToken?: string }>;
};

export default async function ConnectPage({ searchParams }: Props) {
  const params = await searchParams;
  const token = getChannelToken();

  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        <div className="flex items-center gap-3 mb-8">
          <span className="text-red-500 text-2xl">▶</span>
          <h1 className="text-xl font-bold">チャンネル接続</h1>
        </div>

        {/* 成功メッセージ */}
        {params.success && (
          <div className="mb-6 space-y-4">
            <div className="bg-green-900/30 border border-green-600 rounded-xl p-4 text-green-400">
              ✅ 「{params.channelName}」の接続が完了しました！
            </div>
            {params.refreshToken && (
              <div className="bg-gray-900 border border-yellow-600 rounded-xl p-4">
                <p className="text-yellow-400 text-sm font-semibold mb-2">
                  ⚠️ Vercelにデプロイする場合はこのトークンを保存してください
                </p>
                <p className="text-xs text-gray-400 mb-2">CHANNEL_REFRESH_TOKEN の値：</p>
                <code className="block bg-gray-800 rounded p-3 text-xs text-green-300 break-all select-all">
                  {params.refreshToken}
                </code>
                <p className="text-xs text-gray-500 mt-2">↑ 全選択してコピーしてください</p>
              </div>
            )}
          </div>
        )}

        {/* エラーメッセージ */}
        {params.error === "no_refresh_token" && (
          <div className="bg-yellow-900/30 border border-yellow-600 rounded-xl p-4 mb-6 text-yellow-400">
            ⚠️ トークンの取得に失敗しました。もう一度試してください。
          </div>
        )}
        {params.error === "auth_failed" && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 mb-6 text-red-400">
            ❌ 認証がキャンセルされました。
          </div>
        )}

        {/* 接続済みチャンネル */}
        {token && (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-6">
            <p className="text-xs text-gray-500 mb-1">現在接続中のチャンネル</p>
            <p className="text-white font-semibold text-lg">{token.channelName}</p>
            <p className="text-xs text-gray-500 mt-1">
              接続日時: {new Date(token.savedAt).toLocaleString("ja-JP")}
            </p>
          </div>
        )}

        {/* 接続手順 */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="font-semibold text-white mb-4">
            {token ? "別のチャンネルに切り替える" : "チャンネルを接続する"}
          </h2>
          <ol className="text-sm text-gray-400 space-y-3 list-decimal list-inside">
            <li>下のURLをチャンネルのオーナーに送る</li>
            <li>オーナーがURLを開いてGoogleログインする</li>
            <li>「許可」をクリックするだけで完了</li>
          </ol>
        </div>

        {/* 接続URLを生成するボタン */}
        <ConnectButton />

        <div className="mt-4 text-center">
          <a href="/youtube" className="text-sm text-gray-500 hover:text-white transition-colors">
            ← 分析画面に戻る
          </a>
        </div>
      </div>
    </main>
  );
}

function ConnectButton() {
  return (
    <a
      href="/api/youtube/auth?redirect=1"
      className="block w-full bg-red-600 hover:bg-red-500 text-white font-semibold py-3 px-6 rounded-xl transition-colors text-center"
    >
      接続URLを開く（オーナーはここをクリック）
    </a>
  );
}
