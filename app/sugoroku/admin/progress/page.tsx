import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Member, Task } from "@/lib/supabase/types";
import Navbar from "@/app/sugoroku/dashboard/_components/Navbar";
import ProgressOverview from "./_components/ProgressOverview";

export type MemberProgress = {
  memberId: string;
  memberName: string;
  avatarUrl: string | null;
  roadmapId: string | null;
  roadmapTitle: string;
  totalTasks: number;
  doneTasks: number;
  progressPct: number;
  currentTaskTitle: string | null;
  needsRevisionCount: number;
  pendingApprovalCount: number;
  lastActivityAt: string | null;
};

export default async function ProgressPage() {
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

  const { data: members } = await supabase
    .from("members")
    .select("id, name, email, avatar_url, role")
    .order("name");

  const { data: roadmaps } = await supabase
    .from("roadmaps")
    .select("id, member_id, title, created_at");

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, roadmap_id, status, title, level, created_at")
    .is("parent_id", null);

  const roadmapMap = new Map((roadmaps ?? []).map((r) => [r.member_id, r]));

  const progressList: MemberProgress[] = (members ?? []).map((m) => {
    const roadmap = roadmapMap.get(m.id);
    const memberTasks = (tasks ?? []).filter((t) => t.roadmap_id === roadmap?.id);
    const largeTasks = memberTasks.filter((t) => t.level === "large" || !t.level);
    const doneTasks = largeTasks.filter((t) => t.status === "done");
    const inProgressTask = largeTasks.find((t) => t.status === "in_progress");
    const pendingTask = largeTasks.find((t) => t.status === "pending_approval");
    const needsRevision = largeTasks.filter((t) => t.status === "needs_revision").length;
    const pendingApproval = largeTasks.filter((t) => t.status === "pending_approval").length;
    const allSorted = [...largeTasks].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return {
      memberId: m.id,
      memberName: m.name,
      avatarUrl: m.avatar_url,
      roadmapId: roadmap?.id ?? null,
      roadmapTitle: roadmap?.title ?? "未設定",
      totalTasks: largeTasks.length,
      doneTasks: doneTasks.length,
      progressPct:
        largeTasks.length > 0
          ? Math.round((doneTasks.length / largeTasks.length) * 100)
          : 0,
      currentTaskTitle:
        (inProgressTask ?? pendingTask)?.title ?? null,
      needsRevisionCount: needsRevision,
      pendingApprovalCount: pendingApproval,
      lastActivityAt: allSorted[0]?.created_at ?? null,
    };
  });

  return (
    <div className="min-h-screen" style={{ background: "#0f1117" }}>
      <Navbar member={member} />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold" style={{ color: "#e2e8f0" }}>
            📊 全員進捗概要
          </h1>
          <p className="text-sm mt-1" style={{ color: "#94a3b8" }}>
            メンバーごとのロードマップ進捗を一覧で確認できます
          </p>
        </div>
        <ProgressOverview progressList={progressList} />
      </main>
    </div>
  );
}
