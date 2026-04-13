"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import type { Member, Task } from "@/lib/supabase/types";
import type { RoadmapWithTasks } from "@/app/sugoroku/_lib/types";
import { BoardHeader } from "./BoardHeader";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { MemberTabs } from "./MemberTabs";
import { ProgressBar } from "./ProgressBar";
import { DailyReportModal } from "./DailyReportModal";

// dnd-kit はブラウザ固有の API を初期化時に参照するため SSR をスキップする
const SugorokuGrid = dynamic(
  () => import("./SugorokuGrid").then((mod) => mod.SugorokuGrid),
  { ssr: false }
);

interface SugorokuBoardProps {
  currentMember: Member | null;
  allMembers: Pick<Member, "id" | "name" | "email" | "avatar_url" | "role">[];
  roadmaps: RoadmapWithTasks[];
  initialMemberId?: string | null;
}

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return (a.order ?? 0) - (b.order ?? 0);
  });
}

export default function SugorokuBoard({
  currentMember,
  allMembers,
  roadmaps,
  initialMemberId,
}: SugorokuBoardProps) {
  const router = useRouter();
  const isAdmin = currentMember?.role === "admin";

  // URL の ?member= を優先して初期メンバーを決定（admin のみ）
  const defaultMemberId = (() => {
    if (!isAdmin) return currentMember?.id ?? "";
    if (initialMemberId && allMembers.some((m) => m.id === initialMemberId)) {
      return initialMemberId;
    }
    return currentMember?.id ?? "";
  })();

  const [selectedMemberId, setSelectedMemberId] = useState<string>(defaultMemberId);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [localTasksMap, setLocalTasksMap] = useState<Record<string, Task[]>>({});
  const [showDailyReport, setShowDailyReport] = useState(false);

  const activeMemberId = isAdmin ? selectedMemberId : (currentMember?.id ?? "");

  // roadmap を早めに計算し、ref でキャプチャして Realtime effect の deps を最小化
  const roadmap = roadmaps.find((r) => r.member_id === activeMemberId);
  const activeRoadmapIdRef = useRef<string | undefined>(roadmap?.id);
  const roadmapTasksFallbackRef = useRef<Task[]>(roadmap?.tasks ?? []);
  // render ごとに ref を最新値へ更新（副作用なし）
  activeRoadmapIdRef.current = roadmap?.id;
  roadmapTasksFallbackRef.current = roadmap?.tasks ?? [];

  // Supabase Realtime: activeMemberId が変わったときだけ再購読
  useEffect(() => {
    const roadmapId = activeRoadmapIdRef.current;
    if (!roadmapId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`tasks:roadmap:${roadmapId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `roadmap_id=eq.${roadmapId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setLocalTasksMap((prev) => {
              const current = prev[activeMemberId] ?? roadmapTasksFallbackRef.current;
              // 楽観的追加済みの場合は重複させない
              if (current.some((t) => t.id === (payload.new as Task).id)) return prev;
              return { ...prev, [activeMemberId]: [...current, payload.new as Task] };
            });
          } else if (payload.eventType === "UPDATE") {
            setLocalTasksMap((prev) => {
              const current = prev[activeMemberId] ?? roadmapTasksFallbackRef.current;
              // ドラッグ並べ替え中のタスクは楽観的 UI を優先して Realtime を無視
              if (reorderingIds.current.has((payload.new as Task).id)) return prev;
              const updated = payload.new as Task;
              // 大タスク削除の ON DELETE SET NULL により parent_id が null になった
              // 中・小タスクがボードに根タスクとして浮上しないよう除去する
              if (updated.parent_id === null && (updated.level === "medium" || updated.level === "small")) {
                return {
                  ...prev,
                  [activeMemberId]: current.filter((t) => t.id !== updated.id),
                };
              }
              return {
                ...prev,
                [activeMemberId]: current.map((t) => (t.id === updated.id ? updated : t)),
              };
            });
          } else if (payload.eventType === "DELETE") {
            setLocalTasksMap((prev) => {
              const current = prev[activeMemberId] ?? roadmapTasksFallbackRef.current;
              return {
                ...prev,
                [activeMemberId]: current.filter(
                  (t) => t.id !== (payload.old as { id: string }).id
                ),
              };
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // roadmaps は ref 経由でアクセスするため deps に含めない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMemberId]);

  const activeMember = useMemo(
    () =>
      isAdmin
        ? (allMembers.find((m) => m.id === activeMemberId) ?? currentMember)
        : currentMember,
    [isAdmin, allMembers, activeMemberId, currentMember]
  );

  // メモ化した派生値
  const rawTasks = useMemo(
    () => localTasksMap[activeMemberId] ?? roadmap?.tasks ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [localTasksMap, activeMemberId, roadmap?.id]
  );
  const allTasks = useMemo(() => sortTasks(rawTasks), [rawTasks]);
  const tasks = useMemo(() => allTasks.filter((t) => t.parent_id === null), [allTasks]);
  const doneCount = useMemo(() => tasks.filter((t) => t.status === "done").length, [tasks]);

  // rawTasks を ref でキャプチャして handleReorder の deps を最小化
  const rawTasksRef = useRef<Task[]>(rawTasks);
  rawTasksRef.current = rawTasks;

  // ドラッグ中のタスク ID を追跡して Realtime UPDATE との競合を防ぐ
  const reorderingIds = useRef<Set<string>>(new Set());

  // ---- ハンドラ ----
  // UI は Optimistic Update（楽観的更新）+ Supabase Realtime で即時反映する。
  // router.refresh() はロードマップ削除など server component の再描画が必要な場合のみ使用。

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      if (!confirm("このマスを削除しますか？")) return;
      setDeletingTaskId(taskId);

      // 大タスクと子孫（中・小タスク）をローカルから一括除去する。
      // DB は ON DELETE SET NULL のため子タスクが parent_id=NULL の UPDATE イベントを
      // 発火させ、ボードに根タスクとして表示されてしまう問題を防ぐ。
      setLocalTasksMap((prev) => {
        const current = prev[activeMemberId] ?? roadmapTasksFallbackRef.current;
        const mediumIds = new Set(
          current.filter((t) => t.parent_id === taskId).map((t) => t.id)
        );
        const smallIds = new Set(
          current
            .filter((t) => t.parent_id != null && mediumIds.has(t.parent_id))
            .map((t) => t.id)
        );
        const toRemove = new Set([taskId, ...mediumIds, ...smallIds]);
        return { ...prev, [activeMemberId]: current.filter((t) => !toRemove.has(t.id)) };
      });

      const supabase = createClient();
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      setDeletingTaskId(null);
      if (error) {
        console.error("[handleDeleteTask] failed:", error);
        alert("削除に失敗しました。再度お試しください。");
        // 楽観的更新を元に戻すため再取得
        router.refresh();
      }
    },
    [router, activeMemberId]
  );

  const handleDeleteAllTasks = useCallback(async () => {
    const roadmapId = activeRoadmapIdRef.current;
    if (!roadmapId) return;
    setDeletingAll(true);
    setConfirmDeleteAll(false);
    const supabase = createClient();
    const { error } = await supabase.from("roadmaps").delete().eq("id", roadmapId);
    setDeletingAll(false);
    if (error) {
      console.error("[handleDeleteAllTasks] failed:", error);
      alert("ロードマップの削除に失敗しました。再度お試しください。");
      return;
    }
    // ロードマップ自体が削除されるため server component の再描画が必要
    router.refresh();
  }, [router]);

  // ドラッグ並べ替え後のハンドラ
  const handleReorder = useCallback(
    async (newRootTasks: Task[]) => {
      if (!activeRoadmapIdRef.current) return;

      const reorderedRootTasks = newRootTasks.map((t, i) => ({ ...t, order: i + 1 }));
      const otherTasks = rawTasksRef.current.filter((t) => t.parent_id !== null);
      setLocalTasksMap((prev) => ({
        ...prev,
        [activeMemberId]: [...reorderedRootTasks, ...otherTasks],
      }));

      // 並べ替え中フラグをセット（Realtime UPDATE を一時的に無視）
      const reorderedIds = reorderedRootTasks.map((t) => t.id);
      reorderedIds.forEach((id) => reorderingIds.current.add(id));

      const supabase = createClient();
      const results = await Promise.all(
        reorderedRootTasks.map((t) =>
          supabase.from("tasks").update({ order: t.order }).eq("id", t.id)
        )
      );

      reorderedIds.forEach((id) => reorderingIds.current.delete(id));

      const firstError = results.find((r) => r.error)?.error;
      if (firstError) {
        console.error("[handleReorder] failed:", firstError);
        // 失敗時のみ再取得してロールバック
        router.refresh();
      }
    },
    [activeMemberId, router]
  );

  /** メンバータブ切り替え：URL を更新してリロード時も同じ位置を保持 */
  const handleSelectMember = useCallback(
    (memberId: string) => {
      setSelectedMemberId(memberId);
      router.push(`?member=${memberId}`, { scroll: false });
    },
    [router]
  );

  const handleTaskUpdated = useCallback(
    (id: string, patch: Partial<Task>) => {
      setLocalTasksMap((prev) => {
        const curr = prev[activeMemberId] ?? roadmapTasksFallbackRef.current;
        if (!curr.some((t) => t.id === id)) {
          return { ...prev, [activeMemberId]: [...curr, { id, ...patch } as Task] };
        }
        return { ...prev, [activeMemberId]: curr.map((t) => (t.id === id ? { ...t, ...patch } : t)) };
      });
    },
    [activeMemberId]
  );

  const handleTasksDeleted = useCallback(
    (ids: string[]) => {
      const idSet = new Set(ids);
      setLocalTasksMap((prev) => {
        const curr = prev[activeMemberId] ?? roadmapTasksFallbackRef.current;
        return { ...prev, [activeMemberId]: curr.filter((t) => !idSet.has(t.id)) };
      });
    },
    [activeMemberId]
  );

  if (roadmaps.length === 0 && !isAdmin) {
    return (
      <div className="text-center py-24">
        <div className="text-4xl mb-4">🎲</div>
        <p style={{ color: "#94a3b8" }}>まだマップが作成されていません</p>
        <p className="text-sm mt-2" style={{ color: "#4a5568" }}>
          管理者にマップの作成を依頼してください
        </p>
      </div>
    );
  }

  return (
    <div>
      <BoardHeader
        roadmapId={roadmap?.id ?? null}
        title={roadmap?.title ?? "ロードマップ"}
        description={roadmap?.description ?? null}
        isAdmin={isAdmin}
        hasRoadmap={!!roadmap}
        deletingAll={deletingAll}
        onDeleteAllClick={() => setConfirmDeleteAll(true)}
      />

      {confirmDeleteAll && roadmap && (
        <DeleteConfirmDialog
          roadmapTitle={roadmap.title}
          onCancel={() => setConfirmDeleteAll(false)}
          onConfirm={handleDeleteAllTasks}
        />
      )}

      {isAdmin && allMembers.length > 0 && (
        <MemberTabs
          members={allMembers}
          selectedMemberId={selectedMemberId}
          roadmaps={roadmaps}
          onSelect={handleSelectMember}
        />
      )}

      {!roadmap ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: "#1a1d27", border: "1px dashed rgba(108,99,255,0.4)" }}
        >
          <div className="text-4xl mb-4">🎲</div>
          <p style={{ color: "#94a3b8" }}>
            まだマップが作成されていません
          </p>
          {isAdmin && (
            <a
              href="/sugoroku/new-roadmap"
              className="inline-block mt-4 px-5 py-2.5 rounded-xl text-sm font-bold"
              style={{
                background: "linear-gradient(135deg, #6c63ff, #5b52ee)",
                color: "#fff",
              }}
            >
              ✨ マップを生成する
            </a>
          )}
        </div>
      ) : (
        <div
          className="rounded-2xl p-6"
          style={{
            background: "#1a1d27",
            border: "1px solid #2e3347",
            boxShadow: "0 0 0 1px rgba(108,99,255,0.08), 0 4px 24px rgba(108,99,255,0.06)",
            opacity: deletingTaskId ? 0.7 : 1,
          }}
        >
          <ProgressBar done={doneCount} total={tasks.length} />
          {tasks.length > 0 ? (
            <SugorokuGrid
              tasks={tasks}
              allTasks={allTasks}
              currentMember={activeMember as Member}
              isAdmin={isAdmin}
              onDeleteTask={handleDeleteTask}
              onReorder={handleReorder}
              onTaskUpdated={handleTaskUpdated}
              onTaskDeleted={handleTasksDeleted}
            />
          ) : (
            <div className="text-center py-12">
              <p style={{ color: "#94a3b8" }}>
                マスがまだ追加されていません
              </p>
            </div>
          )}
        </div>
      )}

      {/* 日報モーダル（メンバー） */}
      {showDailyReport && roadmap && currentMember && !isAdmin && (
        <DailyReportModal
          roadmapId={roadmap.id}
          memberId={currentMember.id}
          onClose={() => setShowDailyReport(false)}
          onSubmitted={() => setShowDailyReport(false)}
        />
      )}

      {/* 日報ボタン（メンバーのみ、右下固定） */}
      {!isAdmin && roadmap && (
        <button
          onClick={() => setShowDailyReport(true)}
          className="fixed bottom-6 right-6 z-30 flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold shadow-lg"
          style={{
            background: "linear-gradient(135deg, #6c63ff, #5a52e8)",
            color: "#fff",
            boxShadow: "0 8px 24px rgba(108,99,255,0.4)",
          }}
        >
          📖 冒険を記録する
        </button>
      )}
    </div>
  );
}
