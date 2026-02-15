"use client";

import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import { TaskCard } from "@/components/task-card";
import type { Task } from "@/lib/task-types";
import { statusConfig } from "@/lib/task-config";

type KanbanBoardProps = {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onCollaboratorsClick: (task: Task, e: React.MouseEvent) => void;
  onCreateTask?: (domain?: string) => void;
  onDragStart?: (e: React.DragEvent, taskId: string) => void;
  showCreateButton?: boolean;
};

export const KanbanBoard = ({
  tasks,
  onTaskClick,
  onCollaboratorsClick,
  onCreateTask,
  onDragStart,
  showCreateButton = true,
}: KanbanBoardProps) => {
  const tasksBySection: Record<string, Task[]> = {};

  tasks.forEach((task) => {
    const section = task.section || "כללי";
    if (!tasksBySection[section]) {
      tasksBySection[section] = [];
    }
    tasksBySection[section].push(task);
  });

  Object.keys(tasksBySection).forEach((section) => {
    tasksBySection[section].sort((a, b) => {
      const orderA = statusConfig[a.status as keyof typeof statusConfig]?.order ?? statusConfig.pending.order;
      const orderB = statusConfig[b.status as keyof typeof statusConfig]?.order ?? statusConfig.pending.order;
      return orderA - orderB;
    });
  });

  const sectionOrder = ["מיצוב", "איתור", "כללי"];
  const sortedSections = Object.keys(tasksBySection).sort((a, b) => {
    const indexA = sectionOrder.indexOf(a);
    const indexB = sectionOrder.indexOf(b);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.localeCompare(b);
  });

  if (tasks.length === 0) {
    return (
      <div className="flex-1 rounded-lg border bg-card p-12 text-center">
        <p className="text-muted-foreground mb-4">
          אין משימות
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {sortedSections.map((section) => {
        const sectionTasks = tasksBySection[section] || [];
        const uniqueDomains = Array.from(new Set(sectionTasks.map(t => t.domain)));

        return (
          <div
            key={section}
            className="flex min-w-[340px] max-w-[340px] flex-col rounded-lg border border-border bg-card/50 backdrop-blur-sm"
          >
            <div className="border-b border-border bg-card p-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-foreground">{section}</h2>
                  <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs font-medium">
                    {sectionTasks.length}
                  </span>
                </div>
                {showCreateButton && onCreateTask && uniqueDomains.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-md hover:bg-accent"
                    aria-label="הוסף משימה"
                    onClick={() => onCreateTask(uniqueDomains[0])}
                  >
                    <Icons.plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {uniqueDomains.length > 0 && (
                <p className="text-[11px] text-muted-foreground font-medium">
                  {uniqueDomains.join(" • ")}
                </p>
              )}
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto p-3 max-h-[calc(100vh-280px)]">
              {sectionTasks.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-muted-foreground text-sm">
                    אין משימות
                  </p>
                </div>
              ) : (
                sectionTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onClick={() => onTaskClick(task)}
                    onCollaboratorsClick={(e) => onCollaboratorsClick(task, e)}
                    draggable={!!onDragStart}
                    onDragStart={onDragStart ? (e) => onDragStart(e, task.id) : undefined}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
