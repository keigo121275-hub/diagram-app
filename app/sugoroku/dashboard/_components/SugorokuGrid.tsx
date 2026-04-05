"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import type { Member, Task } from "@/lib/supabase/types";
import { TaskCell } from "./TaskCell";
import TaskDetailPanel from "./TaskDetailPanel";

interface SugorokuGridProps {
  tasks: Task[];
  allTasks: Task[];
  currentMember: Member | null;
  isAdmin: boolean;
  onDeleteTask: (taskId: string) => void;
  onReorder: (newTasks: Task[]) => void;
  onTaskUpdated: (id: string, patch: Partial<Task>) => void;
}

const COLS = 5;

export function SugorokuGrid({
  tasks,
  allTasks,
  currentMember,
  isAdmin,
  onDeleteTask,
  onReorder,
  onTaskUpdated,
}: SugorokuGridProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 400, tolerance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 400, tolerance: 8 },
    })
  );

  const currentIndex = useMemo(() => {
    const lastDone = [...tasks].reverse().findIndex((t) => t.status === "done");
    if (lastDone === -1) return 0;
    const lastDoneIdx = tasks.length - 1 - lastDone;
    return Math.min(lastDoneIdx + 1, tasks.length - 1);
  }, [tasks]);

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);
    if (!over || active.id === over.id) return;

    const oldIndex = tasks.findIndex((t) => t.id === active.id);
    const newIndex = tasks.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newTasks = arrayMove(tasks, oldIndex, newIndex);
    onReorder(newTasks);
  }

  // tasks が変わったときだけ再計算
  const rows = useMemo<Task[][]>(() => {
    const result: Task[][] = [];
    for (let i = 0; i < tasks.length; i += COLS) {
      result.push(tasks.slice(i, i + COLS));
    }
    return result;
  }, [tasks]);

  // O(n²) の findIndex を O(1) Map ルックアップに変換
  const originalIndexMap = useMemo(
    () => new Map(tasks.map((t, i) => [t.id, i])),
    [tasks]
  );

  // SortableContext に渡す items も毎回 map しないようメモ化
  const sortableItems = useMemo(() => tasks.map((t) => t.id), [tasks]);

  const handleClosePanel = useCallback(() => setSelectedTask(null), []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={sortableItems} strategy={rectSortingStrategy}>
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
                      const originalIndex = originalIndexMap.get(task.id) ?? 0;
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
        </div>
      </SortableContext>

      <DragOverlay>
        {activeTask ? (
          <div
            className="rounded-xl p-3 rotate-2"
            style={{
              minHeight: "92px",
              background: "rgba(108,99,255,0.25)",
              border: "2px solid #6c63ff",
              boxShadow: "0 0 24px rgba(108,99,255,0.5)",
              cursor: "grabbing",
              opacity: 0.9,
            }}
          >
            <p className="text-xs font-medium mt-5" style={{ color: "#e2e8f0" }}>
              {activeTask.title}
            </p>
          </div>
        ) : null}
      </DragOverlay>

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          allTasks={allTasks}
          onClose={handleClosePanel}
          onTaskUpdated={onTaskUpdated}
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
    </DndContext>
  );
}
