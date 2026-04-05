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
  member_id: string;
  member_name: string;
  roadmap_title: string;
};

export type MemberOption = {
  id: string;
  name: string;
};

/** 与えられた日付を含む週の月曜〜日曜を返す */
function getWeekRange(weekParam?: string): { weekStart: string; weekEnd: string } {
  const base = weekParam ? new Date(`${weekParam}T00:00:00`) : new Date();
  const day = base.getDay(); // 0=日, 1=月 ...
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(base);
  monday.setDate(base.getDate() + diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd: sunday.toISOString().slice(0, 10),
  };
}

export default async function DailyReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; member?: string }>;
}) {
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

  const { week: weekParam, member: memberParam } = await searchParams;
  const { weekStart, weekEnd } = getWeekRange(weekParam);

  // 全メンバー一覧（ドロップダウン用）
  const { data: allMembersData } = await supabase
    .from("members")
    .select("id, name")
    .order("name");
  const allMembers: MemberOption[] = (allMembersData ?? []) as MemberOption[];

  // 選択中メンバー（未指定なら最初のメンバー）
  const selectedMemberId =
    memberParam && allMembers.some((m) => m.id === memberParam)
      ? memberParam
      : (allMembers[0]?.id ?? "");

  // 該当週・該当メンバーの日報を取得
  const { data: reports } = await supabase
    .from("daily_reports")
    .select("id, body, date, created_at, member_id, roadmap_id")
    .eq("member_id", selectedMemberId)
    .gte("date", weekStart)
    .lte("date", weekEnd)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });

  // ロードマップ名を解決
  const roadmapIds = [
    ...new Set(
      (reports ?? []).map((r) => r.roadmap_id).filter((id): id is string => !!id)
    ),
  ];
  const { data: roadmapsData } =
    roadmapIds.length > 0
      ? await supabase.from("roadmaps").select("id, title").in("id", roadmapIds)
      : { data: [] };
  const roadmapMap = new Map((roadmapsData ?? []).map((r) => [r.id, r.title]));

  const memberName = allMembers.find((m) => m.id === selectedMemberId)?.name ?? "不明";

  const items: ReportItem[] = (reports ?? []).map((r) => ({
    id: r.id,
    body: r.body,
    date: r.date,
    created_at: r.created_at,
    member_id: r.member_id ?? "",
    member_name: memberName,
    roadmap_title: r.roadmap_id ? (roadmapMap.get(r.roadmap_id) ?? "不明") : "不明",
  }));

  return (
    <div className="min-h-screen" style={{ background: "#0f1117" }}>
      <Navbar member={member} />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold" style={{ color: "#e2e8f0" }}>
            📝 日報
          </h1>
          <p className="text-sm mt-1" style={{ color: "#94a3b8" }}>
            メンバーの週次進捗を確認する
          </p>
        </div>
        <DailyReportList
          items={items}
          allMembers={allMembers}
          selectedMemberId={selectedMemberId}
          weekStart={weekStart}
          weekEnd={weekEnd}
        />
      </main>
    </div>
  );
}
