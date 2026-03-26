import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ChannelSelector from "./ChannelSelector";

export default async function YoutubePage() {
  const session = await auth();

  if (!session) {
    redirect("/youtube/login");
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-red-500 text-2xl">▶</span>
          <h1 className="text-xl font-bold">YouTube Analytics</h1>
        </div>
        <div className="flex items-center gap-3">
          {session.user?.image && (
            <img
              src={session.user.image}
              alt={session.user.name ?? ""}
              className="w-8 h-8 rounded-full"
            />
          )}
          <span className="text-sm text-gray-400">{session.user?.name}</span>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="text-sm text-gray-500 hover:text-white transition-colors"
            >
              ログアウト
            </button>
          </form>
        </div>
      </header>

      <div className="px-6 py-8">
        <ChannelSelector />
      </div>
    </main>
  );
}
