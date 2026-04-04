"use client";

import { useState } from "react";
import type { Member, Task } from "@/lib/supabase/types";
import { TaskCell } from "./TaskCell";
import TaskDetailPanel from "./TaskDetailPanel";

interface SugorokuGridProps {
  tasks: Task[];
  currentMember: Member | null;
  isAdmin: boolean;
  onDeleteTask: (taskId: string) => void;
}

const COLS = 5;

export function SugorokuGrid({
  tasks,
  currentMember,
  isAdmin,
  onDeleteTask,
}: SugorokuGridProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const currentIndex = (() => {
    const lastDone = [...tasks].reverse().findIndex((t) => t.status === "done");
    if (lastDone === -1) return 0;
    const lastDoneIdx = tasks.length - 1 - lastDone;
    return Math.min(lastDoneIdx + 1, tasks.length - 1);
  })();

  const rows: Task[][] = [];
  for (let i = 0; i < tasks.length; i += COLS) {
    rows.push(tasks.slice(i, i + COLS));
  }

  return (
    <div>
      <div className="space-y-2">
        {rows.map((row, rowIdx) => {
          const isEvenRow = rowIdx % 2 === 0;
          const displayRow = isEvenRow ? row : [...row].reverse();

          return (
            <div key={rowIdx}>
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
              >
                {displayRow.map((task) => {
                  const originalIndex = tasks.findIndex((t) => t.id === task.id);
                  return (
                    <TaskCell
                      key={task.id}
                      task={task}
                      isCurrentPosition={originalIndex === currentIndex}
                      memberForToken={
                        originalIndex === currentIndex ? currentMember : null
                      }
                      onClick={setSelectedTask}
                      cellIndex={originalIndex}
                      isAdmin={isAdmin}
                      onDelete={onDeleteTask}
                    />
                  );
                })}
              </div>

              {rowIdx < rows.length - 1 && (
                <div className="flex justify-end py-1 pr-2">
                  <span style={{ color: "#2e3347", fontSize: "20px" }}>↓</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
