"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

// ── コマホップアニメーション用 ────────────────────────────────────────
interface HopState {
  from: { x: number; y: number };
  to: { x: number; y: number };
  active: boolean;
}

function getCellRect(container: HTMLElement, cellIndex: number) {
  const el = container.querySelector<HTMLElement>(`[data-cell-index="${cellIndex}"]`);
  if (!el) return null;
  return el.getBoundingClientRect();
}

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
  const [hopState, setHopState] = useState<HopState | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const prevCurrentIndexRef = useRef<number | null>(null);

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

  // コマホップアニメーション: currentIndex 変化時に実行
  useEffect(() => {
    const prev = prevCurrentIndexRef.current;
    prevCurrentIndexRef.current = currentIndex;

    if (prev === null || prev === currentIndex || !gridRef.current) return;

    const fromRect = getCellRect(gridRef.current, prev);
    const toRect = getCellRect(gridRef.current, currentIndex);
    if (!fromRect || !toRect) return;

    const fromX = fromRect.left + fromRect.width / 2;
    const fromY = fromRect.top + fromRect.height / 2;
    const toX = toRect.left + toRect.width / 2;
    const toY = toRect.top + toRect.height / 2;

    setHopState({ from: { x: fromX, y: fromY }, to: { x: toX, y: toY }, active: false });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setHopState((s) => (s ? { ...s, active: true } : null));
      });
    });

    const cleanup = setTimeout(() => setHopState(null), 700);
    return () => clearTimeout(cleanup);
  }, [currentIndex]);

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

  const rows = useMemo<Task[][]>(() => {
    const result: Task[][] = [];
    for (let i = 0; i < tasks.length; i += COLS) {
      result.push(tasks.slice(i, i + COLS));
    }
    return result;
  }, [tasks]);

  const originalIndexMap = useMemo(
    () => new Map(tasks.map((t, i) => [t.id, i])),
    [tasks]
  );

  const sortableItems = useMemo(() => tasks.map((t) => t.id), [tasks]);

  const handleClosePanel = useCallback(() => setSelectedTask(null), []);

  const totalCells = tasks.length;

  return (
    <>
      <DndContext
        id="sugoroku-grid"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sortableItems} strategy={rectSortingStrategy}>
          <div ref={gridRef}>
            <div className="space-y-0">
              {rows.map((row, rowIdx) => {
                const displayRow = row;

                return (
                  <div key={rowIdx}>
                    {/* セルの行 */}
                    <div
                      className="grid gap-2 pt-5"
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
                            totalCells={totalCells}
                            isAdmin={isAdmin}
                            onDelete={onDeleteTask}
                          />
                        );
                      })}
                    </div>

                    {/* 行コネクターなし */}
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
      </DndContext>

      {/* コマホップアニメーション オーバーレイ */}
      {hopState && currentMember && (
        <div
          className="fixed pointer-events-none z-50 flex items-center justify-center rounded-full text-lg font-bold"
          style={{
            width: "36px",
            height: "36px",
            left: hopState.active ? hopState.to.x - 18 : hopState.from.x - 18,
            top: hopState.active
              ? hopState.to.y - 18
              : hopState.from.y - 18,
            background: "linear-gradient(135deg,#6c63ff,#a78bfa)",
            border: "2px solid #fff",
            boxShadow: "0 0 20px rgba(108,99,255,0.8)",
            transition: hopState.active
              ? "left 0.45s cubic-bezier(.4,0,.2,1), top 0.45s cubic-bezier(.4,0,.2,1)"
              : undefined,
            overflow: "hidden",
          }}
        >
          {currentMember.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentMember.avatar_url}
              alt={currentMember.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span style={{ fontSize: "14px" }}>
              {currentMember.name.slice(0, 1)}
            </span>
          )}
        </div>
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
    </>
  );
}
