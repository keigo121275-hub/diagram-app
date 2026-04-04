import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Member } from "@/lib/supabase/types";
import Navbar from "@/app/sugoroku/dashboard/_components/Navbar";
import DailyReportList from "./_components/DailyReportList";

export type ReportItem = {
  id: string;
  body: string;
  date: string;
  created_at: string;
  member_name: string;
  roadmap_title: string;
};

export default async function DailyReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sugoroku/login");

  const { data: memberData } = await supabase
    .from("members")
    .select("*")
    .eq("id", user.id)
    .single();
  const member = memberData as Member | null;
  if (member?.role !== "admin") redirect("/sugoroku/dashboard");

  // 日報を取得（最新100件）
  const { data: reports } = await supabase
    .from("daily_reports")
    .select("id, body, date, created_at, member_id, roadmap_id")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  // メンバー・ロードマップ名を解決
  const memberIds = [...new Set((reports ?? []).map((r) => r.member_id).filter((id): id is string => !!id))];
  const roadmapIds = [...new Set((reports ?? []).map((r) => r.roadmap_id).filter((id): id is string => !!id))];

  const [membersRes, roadmapsRes] = await Promise.all([
    memberIds.length > 0
      ? supabase.from("members").select("id, name").in("id", memberIds)
      : Promise.resolve({ data: [] }),
    roadmapIds.length > 0
      ? supabase.from("roadmaps").select("id, title").in("id", roadmapIds)
      : Promise.resolve({ data: [] }),
  ]);

  const memberMap = new Map((membersRes.data ?? []).map((m) => [m.id, m.name]));
  const roadmapMap = new Map((roadmapsRes.data ?? []).map((r) => [r.id, r.title]));

  const items: ReportItem[] = (reports ?? []).map((r) => ({
    id: r.id,
    body: r.body,
    date: r.date,
    created_at: r.created_at,
    member_name: r.member_id ? (memberMap.get(r.member_id) ?? "不明") : "不明",
    roadmap_title: r.roadmap_id ? (roadmapMap.get(r.roadmap_id) ?? "不明") : "不明",
  }));

  return (
    <div className="min-h-screen" style={{ background: "#0f1117" }}>
      <Navbar member={member} />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold" style={{ color: "#e2e8f0" }}>
            📝 日報一覧
          </h1>
          <p className="text-sm mt-1" style={{ color: "#94a3b8" }}>
            メンバーから投稿された日報・進捗報告
          </p>
        </div>
        <DailyReportList items={items} />
      </main>
    </div>
  );
}
