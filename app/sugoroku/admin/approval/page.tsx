import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Member } from "@/lib/supabase/types";
import Navbar from "@/app/sugoroku/dashboard/_components/Navbar";
import ApprovalList from "./_components/ApprovalList";

export type ApprovalItem = {
  id: string;
  task_id: string;
  task_title: string;
  task_level: string | null;
  roadmap_title: string;
  requested_by_name: string;
  created_at: string;
};

export default async function ApprovalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sugoroku/login");

  const { data: memberData } = await supabase
    .from("members")
    .select("*")
    .eq("id", user.id)
    .single();
  const member = memberData as Member | null;
  if (member?.role !== "admin") redirect("/sugoroku/dashboard");

  // 承認待ちの申請を取得
  const { data: requests } = await supabase
    .from("approval_requests")
    .select(`
      id,
      task_id,
      created_at,
      tasks (
        title,
        level,
        roadmaps ( title )
      ),
      members!approval_requests_requested_by_fkey ( name )
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const items: ApprovalItem[] = (requests ?? []).map((r: Record<string, unknown>) => {
    const task = r.tasks as Record<string, unknown> | null;
    const roadmap = task?.roadmaps as Record<string, unknown> | null;
    const requester = r.members as Record<string, unknown> | null;
    return {
      id: r.id as string,
      task_id: r.task_id as string,
      task_title: (task?.title as string) ?? "不明",
      task_level: (task?.level as string) ?? null,
      roadmap_title: (roadmap?.title as string) ?? "不明",
      requested_by_name: (requester?.name as string) ?? "不明",
      created_at: r.created_at as string,
    };
  });

  return (
    <div className="min-h-screen" style={{ background: "#0f1117" }}>
      <Navbar member={member} />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold" style={{ color: "#e2e8f0" }}>
            承認リスト
          </h1>
          <p className="text-sm mt-1" style={{ color: "#94a3b8" }}>
            メンバーからの完了申請を承認・差し戻しします
          </p>
        </div>
        <ApprovalList items={items} />
      </main>
    </div>
  );
}
