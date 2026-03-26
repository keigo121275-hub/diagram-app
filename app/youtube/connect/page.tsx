/**
 * チャンネル接続管理ページ
 *
 * 接続フロー:
 * 1. 「Google アカウントで認証して追加」→ OAuth → callback で mine:true のCHを自動保存
 *    + pending トークンを一時保存して step=add-managed でこのページに戻る
 * 2. step=add-managed の場合、「権限共有CHをIDで追加」フォームを表示
 *    → AddManagedChannelForm が /api/youtube/channels/add に POST して追加
 */
import { getAllChannelTokens } from "@/lib/channelTokenStore";
import { getPendingToken } from "@/lib/pendingTokenStore";
import AddManagedChannelForm from "./AddManagedChannelForm";

type Props = {
  searchParams: Promise<{
    step?: string;
    autoAdded?: string;
    autoCount?: string;
    error?: string;
  }>;
};

export default async function ConnectPage({ searchParams }: Props) {
  const params = await searchParams;
  const tokens = await getAllChannelTokens();
  const hasPendingToken = !!getPendingToken();

  const isAddManagedStep = params.step === "add-managed";

  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        <div className="flex items-center gap-3 mb-8">
          <span className="text-red-500 text-2xl">▶</span>
          <h1 className="text-xl font-bold">チャンネル接続管理</h1>
        </div>

        {/* OAuth 後の自動追加結果 */}
        {isAddManagedStep && params.autoCount && (
          <div className="mb-6 bg-green-900/30 border border-green-600 rounded-xl p-4 text-green-400">
            ✅ 「{params.autoAdded}」
            {Number(params.autoCount) > 1 && ` ほか ${Number(params.autoCount) - 1}件`}
            を自動接続しました。
            <br />
            <span className="text-sm text-green-300">
              権限共有チャンネルがあれば、下のフォームから追加できます。
            </span>
          </div>
        )}
        {isAddManagedStep && !params.autoCount && (
          <div className="mb-6 bg-blue-900/30 border border-blue-600 rounded-xl p-4 text-blue-300">
            認証が完了しました。接続したいチャンネルIDを入力してください。
          </div>
        )}

        {/* エラーメッセージ */}
        {params.error === "no_refresh_token" && (
          <div className="mb-6 bg-yellow-900/30 border border-yellow-600 rounded-xl p-4 text-yellow-400">
            ⚠️ リフレッシュトークンが取得できませんでした。もう一度試してください。
          </div>
        )}
        {params.error === "auth_failed" && (
          <div className="mb-6 bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-400">
            ❌ 認証がキャンセルされました。
          </div>
        )}
        {params.error === "no_channel" && (
          <div className="mb-6 bg-yellow-900/30 border border-yellow-600 rounded-xl p-4 text-yellow-400">
            ⚠️ このアカウントには所有チャンネルがありませんでした。
            下のフォームにチャンネルIDを入力して追加できます。
          </div>
        )}

        {/* 権限共有チャンネルの追加フォーム（OAuth直後 or 手動で表示） */}
        {(isAddManagedStep || (hasPendingToken && tokens.length > 0)) && (
          <AddManagedChannelForm />
        )}

        {/* 接続済みチャンネル一覧 */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            接続済みチャンネル ({tokens.length}件)
          </h2>
          {tokens.length === 0 ? (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-gray-500 text-sm">
              まだチャンネルが接続されていません
            </div>
          ) : (
            <div className="space-y-3">
              {tokens.map((token) => (
                <div
                  key={token.channelId}
                  className="bg-gray-900 border border-gray-700 rounded-xl p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="text-white font-semibold">{token.channelName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      ID: {token.channelId}
                    </p>
                    <p className="text-xs text-gray-500">
                      接続日時: {new Date(token.savedAt).toLocaleString("ja-JP")}
                    </p>
                  </div>
                  <form action="/api/youtube/channels/disconnect" method="POST">
                    <input type="hidden" name="channelId" value={token.channelId} />
                    <button
                      type="submit"
                      className="text-xs text-gray-600 hover:text-red-400 transition-colors"
                    >
                      削除
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 新しいチャンネルを追加（OAuth経由） */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="font-semibold text-white mb-2">Google アカウントで追加する</h2>
          <p className="text-sm text-gray-400 mb-4">
            チャンネルのオーナーアカウント、またはブランドアカウントのオーナーで認証すると自動接続されます。
            権限共有チャンネルを追加したい場合はこの認証後にチャンネルIDを入力してください。
          </p>
          <a
            href="/api/youtube/auth?redirect=1"
            className="block w-full bg-red-600 hover:bg-red-500 text-white font-semibold py-3 px-6 rounded-xl transition-colors text-center"
          >
            Google アカウントで認証して追加
          </a>
        </div>

        <div className="mt-4 text-center">
          <a href="/youtube" className="text-sm text-gray-500 hover:text-white transition-colors">
            ← 分析画面に戻る
          </a>
        </div>
      </div>
    </main>
  );
}
