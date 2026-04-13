import { memo, useMemo } from "react";
import type { Member, Task } from "@/lib/supabase/types";

interface MemberTabsProps {
  members: Pick<Member, "id" | "name" | "avatar_url" | "role">[];
  selectedMemberId: string;
  roadmaps: { member_id: string; tasks: Pick<Task, "status">[] }[];
  onSelect: (memberId: string) => void;
}

export const MemberTabs = memo(function MemberTabs({
  members,
  selectedMemberId,
  roadmaps,
  onSelect,
}: MemberTabsProps) {
  // O(members × roadmaps) の繰り返し find を O(1) Map ルックアップに変換
  const roadmapMap = useMemo(
    () => new Map(roadmaps.map((r) => [r.member_id, r])),
    [roadmaps]
  );

  return (
    <div
      className="flex gap-2 mb-6 overflow-x-auto pb-1"
      style={{ scrollbarWidth: "thin" }}
    >
      {members.map((m) => {
        const memberRoadmap = roadmapMap.get(m.id);
        const memberTasks = memberRoadmap?.tasks ?? [];
        const memberDone = memberTasks.filter((t) => t.status === "done").length;
        const memberPct =
          memberTasks.length === 0
            ? 0
            : Math.round((memberDone / memberTasks.length) * 100);
        const isSelected = selectedMemberId === m.id;

        return (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm whitespace-nowrap transition-all"
            style={{
              background: isSelected ? "rgba(108,99,255,0.15)" : "#1a1d27",
              border: `1px solid ${isSelected ? "#6c63ff" : "#2e3347"}`,
              color: isSelected ? "#e2e8f0" : "#94a3b8",
            }}
          >
            {m.avatar_url ? (
              <img
                src={m.avatar_url}
                alt={m.name}
                className="w-5 h-5 rounded-full object-cover"
              />
            ) : (
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  background: "linear-gradient(135deg, #6c63ff, #4ade80)",
                  color: "#fff",
                }}
              >
                {m.name.slice(0, 1)}
              </div>
            )}
            <span>{m.name}</span>
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: "#232636", color: "#94a3b8" }}
            >
              {memberPct}%
            </span>
          </button>
        );
      })}
    </div>
  );
});
