import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ChannelSelector from "./ChannelSelector";

export default async function YoutubePage() {
  const session = await auth();

  if (!session) {
    redirect("/youtube/login");
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white pb-[env(safe-area-inset-bottom)]">
      <header className="border-b border-gray-800 px-4 py-3 sm:px-6 sm:py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="text-red-500 text-xl sm:text-2xl flex-shrink-0">▶</span>
          <h1 className="text-lg sm:text-xl font-bold truncate">YouTube Analytics</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {session.user?.image && (
            <img
              src={session.user.image}
              alt={session.user.name ?? ""}
              className="w-8 h-8 rounded-full flex-shrink-0"
            />
          )}
          <span className="text-xs sm:text-sm text-gray-400 max-w-[140px] sm:max-w-none truncate">
            {session.user?.name}
          </span>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="text-xs sm:text-sm text-gray-500 hover:text-white transition-colors whitespace-nowrap"
            >
              ログアウト
            </button>
          </form>
        </div>
      </header>

      <div className="px-4 py-5 sm:px-6 sm:py-8 max-w-[1600px] mx-auto w-full">
        <ChannelSelector />
      </div>
    </main>
  );
}
