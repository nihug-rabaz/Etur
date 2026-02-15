"use client";

import { Avatar } from "@/components/avatar";
import { Icons } from "@/components/icons";
import { getPriorityConfig, getStatusColor } from "@/lib/task-config";
import type { Task } from "@/lib/task-types";

type PinnedTasksSidebarProps = {
  pinnedTasks: Set<string>;
  allTasks: Task[];
  activeTab: "active" | "completed";
  onTabChange: (tab: "active" | "completed") => void;
  onTaskClick: (task: Task) => void;
  onRemovePinned: (taskId: string, e: React.MouseEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
};

export const PinnedTasksSidebar = ({
  pinnedTasks,
  allTasks,
  activeTab,
  onTabChange,
  onTaskClick,
  onRemovePinned,
  onDragOver,
  onDrop,
}: PinnedTasksSidebarProps) => {
  const pinnedTasksList = allTasks.filter((task) => pinnedTasks.has(task.id));
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sortedPinnedTasks = pinnedTasksList.sort((a, b) => {
    const priorityA = priorityOrder[a.priority as keyof typeof priorityOrder] ?? priorityOrder.medium;
    const priorityB = priorityOrder[b.priority as keyof typeof priorityOrder] ?? priorityOrder.medium;
    return priorityA - priorityB;
  });

  const activePinnedTasks = sortedPinnedTasks.filter((task) => task.status !== "completed");
  const completedPinnedTasks = sortedPinnedTasks.filter((task) => task.status === "completed");
  const displayedPinnedTasks = activeTab === "active" ? activePinnedTasks : completedPinnedTasks;

  return (
    <div className="rounded-lg border border-border bg-card/50 backdrop-blur-sm h-full flex flex-col">
      <div className="border-b border-border bg-card p-3.5">
        <h2 className="text-base font-semibold">משימות לשבוע הקרוב</h2>
        <p className="text-muted-foreground text-[11px] mt-0.5 leading-relaxed">
          גרור משימות לכאן כדי לסמן אותן
        </p>
      </div>

      <div className="flex border-b border-border">
        <button
          onClick={() => onTabChange("active")}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === "active"
              ? "border-b-2 border-foreground text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          פעילות ({activePinnedTasks.length})
        </button>
        <button
          onClick={() => onTabChange("completed")}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === "completed"
              ? "border-b-2 border-foreground text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          בוצעו ({completedPinnedTasks.length})
        </button>
      </div>

      <div
        className="flex-1 p-3 space-y-2.5 overflow-y-auto min-h-[200px]"
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {displayedPinnedTasks.length === 0 ? (
          <div className="flex items-center justify-center h-32 border-2 border-dashed border-border rounded-lg bg-muted/20">
            <p className="text-muted-foreground text-sm text-center">
              {activeTab === "active" 
                ? "גרור משימות לכאן"
                : "אין משימות שבוצעו"}
            </p>
          </div>
        ) : (
          displayedPinnedTasks.map((task) => {
            const statusColor = getStatusColor(task.status || "pending");
            const priority = getPriorityConfig(task.priority || "medium");
            return (
              <div
                key={task.id}
                className="group relative rounded-lg border border-border bg-card p-2.5 transition-all hover:shadow-md hover:border-foreground/20 cursor-pointer"
                onClick={() => onTaskClick(task)}
              >
                <button
                  onClick={(e) => onRemovePinned(task.id, e)}
                  className="absolute left-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                  aria-label="הסר מסומן"
                >
                  <Icons.x className="h-3.5 w-3.5" />
                </button>
                <div className="mb-2 pr-6">
                  <h3 className="font-semibold text-[13px] leading-snug mb-0.5">
                    {task.title}
                  </h3>
                  {task.description && (
                    <p className="text-muted-foreground line-clamp-1 text-[11px]">
                      {task.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${priority.color}`}>
                    {priority.label}
                  </span>
                  <span className="text-muted-foreground text-[10px] truncate">
                    {task.domain}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-0.5">
                    {task.collaborators && task.collaborators.length > 0 && (
                      <>
                        {task.collaborators.slice(0, 3).map((collab, index) => (
                          <div
                            key={collab.id}
                            className="relative"
                            style={{ marginRight: index > 0 ? "-6px" : "0" }}
                          >
                            <Avatar
                              name={collab.name}
                              email={collab.email}
                              size="sm"
                              className="border-2 border-card ring-1 ring-border"
                            />
                          </div>
                        ))}
                        {task.collaborators.length > 3 && (
                          <span className="text-muted-foreground text-[10px] ml-1">
                            +{task.collaborators.length - 3}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {task.dueDate && (
                      <span className="text-muted-foreground text-[10px]">
                        {new Date(task.dueDate).toLocaleDateString("he-IL", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${statusColor}`}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
