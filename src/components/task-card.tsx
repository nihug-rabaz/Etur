"use client";

import { Avatar } from "@/components/avatar";
import { Icons } from "@/components/icons";
import { getPriorityConfig, getStatusConfig } from "@/lib/task-config";
import type { Task } from "@/lib/task-types";

type TaskCardProps = {
  task: Task;
  onClick: () => void;
  onCollaboratorsClick?: (e: React.MouseEvent) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
};

const getSectionColor = (section?: string | null) => {
  if (section === "מיצוב") return {
    bg: "bg-blue-600",
    text: "text-blue-700 dark:text-blue-300",
    bgLight: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    indicator: "bg-blue-500",
  };
  if (section === "איתור") return {
    bg: "bg-emerald-600",
    text: "text-emerald-700 dark:text-emerald-300",
    bgLight: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800",
    indicator: "bg-emerald-500",
  };
  return {
    bg: "bg-gray-500",
    text: "text-gray-700 dark:text-gray-300",
    bgLight: "bg-gray-50 dark:bg-gray-900/30",
    border: "border-gray-200 dark:border-gray-800",
    indicator: "bg-gray-400",
  };
};

export const TaskCard = ({
  task,
  onClick,
  onCollaboratorsClick,
  draggable = false,
  onDragStart,
}: TaskCardProps) => {
  const status = getStatusConfig(task.status || "pending");
  const priority = getPriorityConfig(task.priority || "medium");
  const sectionColors = getSectionColor(task.section);
  const isChildTask = !!task.parentTaskId;

  return (
    <div
      className={`group relative overflow-hidden rounded-lg border transition-all cursor-pointer ${
        isChildTask
          ? `${status.stickyNoteBorder} ${status.stickyNoteColor} ${status.stickyNoteShadow} hover:shadow-lg hover:scale-[1.01] p-3.5`
          : "border-border bg-card hover:shadow-md hover:border-foreground/20 p-3.5"
      }`}
      style={isChildTask ? {
        transform: 'rotate(-0.3deg)',
      } : {}}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
    >
      {/* Sticky note corner effect for child tasks */}
      {isChildTask && (
        <div className="absolute top-0 right-0 w-0 h-0 border-l-[20px] border-l-transparent border-t-[20px] border-t-black/10" />
      )}
      {/* Status indicator dot on right (only for child tasks) */}
      {isChildTask && (
        <div
          className={`absolute right-2 top-2 h-2 w-2 rounded-full ${status.color}`}
        />
      )}
      {/* Section color indicator (if section exists) */}
      {task.section && !isChildTask && (
        <div
          className={`absolute left-0 top-0 h-full w-1 rounded-r-sm ${sectionColors.indicator}`}
        />
      )}

      <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
        <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${priority.color}`}>
          {priority.label}
        </span>
        {task.isGeneral && (
          <span className="rounded-md px-2 py-0.5 text-[11px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
            כללי
          </span>
        )}
      </div>

      <div className={`${isChildTask ? "relative z-10" : ""}`}>
        {task.parentTitle && (
          <div className="mb-2 flex items-center">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${
              isChildTask 
                ? "bg-card/80 text-foreground border-border backdrop-blur-sm" 
                : "bg-muted text-muted-foreground border-border"
            }`}>
              <Icons.chevronUp className="h-3 w-3" />
              <span className="text-[10px] opacity-70">אב:</span>
              <span className="font-semibold">{task.parentTitle}</span>
            </span>
          </div>
        )}
        <h3 className={`mb-1.5 font-semibold leading-snug text-[15px] ${isChildTask ? status.textColor : "text-foreground"}`}>
          {task.title}
        </h3>

        {task.description && (
          <p className={`${isChildTask ? status.textColor : "text-muted-foreground"} ${isChildTask ? "opacity-85" : ""} mb-2.5 line-clamp-2 text-[13px] leading-relaxed`}>
            {task.description}
          </p>
        )}

        <div className="mb-2.5 flex flex-wrap gap-1.5 items-center">
          {task.section && !isChildTask && (
            <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold text-white ${sectionColors.bg}`}>
              {task.section}
            </span>
          )}
          <span className={`rounded-md ${sectionColors.bgLight} ${sectionColors.text} px-2 py-0.5 text-[11px] font-medium border ${sectionColors.border}`}>
            {task.topic}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div
            className="relative flex items-center gap-1 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onCollaboratorsClick?.(e);
            }}
          >
            {task.collaborators && task.collaborators.length > 0 ? (
              task.collaborators.map((collab, index) => (
                <div
                  key={collab.id}
                  className="relative"
                  style={{ marginRight: index > 0 ? "-6px" : "0" }}
                  title={collab.name || collab.email}
                >
                  <Avatar
                    name={collab.name}
                    email={collab.email}
                    size="sm"
                    className="border-2 border-card ring-1 ring-border"
                  />
                </div>
              ))
            ) : (
              <span className="text-muted-foreground text-[11px]">
                אין שותפים
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {task.discussionCount != null && task.discussionCount > 0 && (
              <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium flex items-center gap-1 ${
                task.hasUnreadDiscussion
                  ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                  : "bg-muted text-muted-foreground"
              }`}>
                <Icons.messageCircle className="h-3 w-3" />
                {task.discussionCount}
                {task.hasUnreadDiscussion && (
                  <span className="text-[10px]">חדש</span>
                )}
              </span>
            )}
            {task.dueDate && (
              <span className={`${isChildTask ? status.textColor : "text-muted-foreground"} ${isChildTask ? "opacity-85" : ""} text-[11px] font-medium flex items-center gap-1`}>
                <Icons.calendar className="h-3 w-3" />
                {new Date(task.dueDate).toLocaleDateString(
                  "he-IL",
                  {
                    month: "short",
                    day: "numeric",
                  },
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
