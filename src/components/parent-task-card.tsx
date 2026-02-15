"use client";

import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { Icons } from "@/components/icons";
import { getPriorityConfig } from "@/lib/task-config";
import type { ParentTask } from "@/lib/task-types";
import type { Task } from "@/lib/task-types";
import { TaskCard } from "@/components/task-card";

type ParentTaskCardProps = {
  parentTask: ParentTask;
  onClick: () => void;
  childTasks?: Task[];
  childTasksCount?: number;
  onChildTaskClick?: (task: Task) => void;
  onChildCollaboratorsClick?: (task: Task, e: React.MouseEvent) => void;
};

const getSectionColor = (section: string) => {
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

export const ParentTaskCard = ({
  parentTask,
  onClick,
  childTasks = [],
  childTasksCount = 0,
  onChildTaskClick,
  onChildCollaboratorsClick,
}: ParentTaskCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const priority = getPriorityConfig(parentTask.priority || "medium");
  const sectionColors = getSectionColor(parentTask.section);
  const hasChildren = (childTasks?.length || 0) > 0 || childTasksCount > 0;

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.expand-button') || target.closest('.child-tasks-container')) {
      return;
    }
    onClick();
  };

  return (
    <div className="space-y-2.5">
      <div
        className={`group relative overflow-hidden rounded-lg border ${sectionColors.border} ${sectionColors.bgLight} p-4 transition-all hover:shadow-md hover:border-foreground/20 cursor-pointer h-full flex flex-col`}
        onClick={handleCardClick}
      >
        <div
          className={`absolute left-0 top-0 h-full w-1 rounded-r-sm ${sectionColors.indicator}`}
        />

        <div className="flex-1 flex flex-col">
          <div className="flex items-start justify-between mb-2.5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold text-white ${sectionColors.bg} whitespace-nowrap`}>
                  {parentTask.section}
                </span>
                <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${priority.color} whitespace-nowrap`}>
                  {priority.label}
                </span>
              </div>
              <h3 className={`text-[17px] font-semibold leading-snug mb-1.5 ${sectionColors.text} break-words`}>
                {parentTask.title}
              </h3>
              <p className={`${sectionColors.text} opacity-70 text-[13px] font-medium line-clamp-2`}>
                {parentTask.topic}
              </p>
            </div>
            {parentTask.discussionCount != null && parentTask.discussionCount > 0 && (
              <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium flex items-center gap-1 flex-shrink-0 ml-2 ${
                parentTask.hasUnreadDiscussion
                  ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                  : "bg-muted text-muted-foreground"
              }`}>
                <Icons.messageCircle className="h-3 w-3" />
                {parentTask.discussionCount}
                {parentTask.hasUnreadDiscussion && (
                  <span className="text-[10px]">חדש</span>
                )}
              </span>
            )}
          </div>

          <div className="mt-auto pt-2.5 border-t border-border flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Avatar
                name={parentTask.createdBy_name}
                email={parentTask.createdBy_email}
                size="sm"
              />
              <span className="text-[11px] text-muted-foreground truncate">
                {parentTask.createdBy_name || parentTask.createdBy_email}
              </span>
            </div>
            {hasChildren && (
              <button
                onClick={handleToggleExpand}
                className="expand-button flex items-center gap-1 hover:bg-accent rounded-md px-2.5 py-1 transition-colors bg-muted/50 text-[11px] font-medium"
                title={isExpanded ? "סגור משימות" : "הראה משימות"}
              >
                <Icons.tasks className="h-3 w-3" />
                <span>{childTasksCount || childTasks?.length || 0}</span>
                {isExpanded ? (
                  <Icons.chevronUp className="h-3 w-3" />
                ) : (
                  <Icons.chevronDown className="h-3 w-3" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
      {isExpanded && hasChildren && (
        <div className="child-tasks-container mt-2 ml-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
          {childTasks && childTasks.length > 0 ? (
            childTasks.map((childTask) => (
              <TaskCard
                key={childTask.id}
                task={childTask}
                onClick={() => onChildTaskClick?.(childTask)}
                onCollaboratorsClick={onChildCollaboratorsClick ? (e) => onChildCollaboratorsClick(childTask, e) : undefined}
              />
            ))
          ) : (
            <p className="text-[11px] text-muted-foreground pl-3">אין משימות בנים</p>
          )}
        </div>
      )}
    </div>
  );
};
