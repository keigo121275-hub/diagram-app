import { signOut } from "@/auth";

export default function UnauthorizedPage() {
  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="bg-gray-900 rounded-2xl p-10 flex flex-col items-center gap-6 shadow-2xl border border-gray-800 w-full max-w-sm text-center">
        <div className="flex items-center gap-3">
          <span className="text-red-500 text-3xl">▶</span>
          <h1 className="text-xl font-bold text-white">YouTube Analytics</h1>
        </div>
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 w-full">
          <p className="text-red-400 font-semibold mb-1">アクセスが許可されていません</p>
          <p className="text-gray-400 text-sm">
            このツールへのアクセス権がありません。<br />
            管理者に連絡してください。
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/youtube/login" });
          }}
        >
          <button
            type="submit"
            className="text-sm text-gray-500 hover:text-white transition-colors"
          >
            別のアカウントでログイン
          </button>
        </form>
      </div>
    </main>
  );
}
