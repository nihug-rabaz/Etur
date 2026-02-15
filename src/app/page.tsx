"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Icons } from "@/components/icons";
import { SECTION_OPTIONS, TOPICS_BY_SECTION } from "@/lib/topics";
import { KanbanBoard } from "@/components/kanban-board";
import { TaskDetailsPopup } from "@/components/task-details-popup";
import { CollaboratorsPopup } from "@/components/collaborators-popup";
import { SearchAndFilters } from "@/components/search-and-filters";
import { PinnedTasksSidebar } from "@/components/pinned-tasks-sidebar";
import { ParentTaskCard } from "@/components/parent-task-card";
import { TaskCardSkeleton, ParentTaskCardSkeleton } from "@/components/task-card-skeleton";
import type { Task, ParentTask } from "@/lib/task-types";

export default function HomePage() {
  const { data: session } = useSession();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [parentTasks, setParentTasks] = useState<ParentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string>("all");
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
  const [selectedTaskForCollaborators, setSelectedTaskForCollaborators] = useState<{
    task: Task;
    position: { top: number; left: number };
  } | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [pinnedTasks, setPinnedTasks] = useState<Set<string>>(new Set());
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [pinnedTasksTab, setPinnedTasksTab] = useState<"active" | "completed">("active");
  const [activeTab, setActiveTab] = useState<"tasks" | "parent-tasks">("tasks");

  useEffect(() => {
    if (!session?.user?.id) return;
    
    const fetchPinnedTasks = async () => {
      try {
        const response = await fetch("/api/pinned-tasks");
        if (response.ok) {
          const data = await response.json();
          setPinnedTasks(new Set(data.taskIds || []));
        }
      } catch (err) {
        console.error("Failed to load pinned tasks:", err);
      }
    };

    fetchPinnedTasks();
  }, [session]);
  const [selectedDomainForTask, setSelectedDomainForTask] = useState<string>("");
  const [users, setUsers] = useState<Array<{ id: string; name: string | null; email: string }>>([]);
  const [domainsList, setDomainsList] = useState<Array<{ id: string; name: string }>>([]);
  const [parentTasksList, setParentTasksList] = useState<Array<{ id: string; title: string; section: string; domain: string; topic: string }>>([]);
  const [createTaskLoading, setCreateTaskLoading] = useState(false);
  const [createTaskError, setCreateTaskError] = useState("");
  const [createTaskMode, setCreateTaskMode] = useState<"parent" | "child" | "general">("parent");
  const [createdParentTaskId, setCreatedParentTaskId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    domain: "",
    topic: "",
    section: "",
    leaderId: "",
    dueDate: "",
    priority: "medium",
    collaboratorIds: [] as string[],
    parentTaskId: "",
  });

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }

    const fetchTasks = async () => {
      try {
        const cacheKey = "tasks";
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          const now = Date.now();
          if (now - parsed.timestamp < 10000) {
            setTasks(parsed.data.tasks || []);
            setLoading(false);
            return;
          }
        }

        const response = await fetch("/api/tasks", {
          next: { revalidate: 10 },
        });
        if (response.ok) {
          const data = await response.json();
          setTasks(data.tasks || []);
          sessionStorage.setItem(
            cacheKey,
            JSON.stringify({ data, timestamp: Date.now() }),
          );
        }
      } catch (err) {
        console.error("Failed to fetch tasks:", err);
      } finally {
        setLoading(false);
      }
    };

    const fetchParentTasks = async () => {
      try {
        const cacheKey = "parent-tasks";
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          const now = Date.now();
          if (now - parsed.timestamp < 10000) {
            setParentTasks(parsed.data.parentTasks || []);
            return;
          }
        }

        const response = await fetch("/api/parent-tasks", {
          next: { revalidate: 10 },
        });
        if (response.ok) {
          const data = await response.json();
          setParentTasks(data.parentTasks || []);
          sessionStorage.setItem(
            cacheKey,
            JSON.stringify({ data, timestamp: Date.now() }),
          );
        }
      } catch (err) {
        console.error("Failed to fetch parent tasks:", err);
      }
    };

    fetchTasks();
    fetchParentTasks();

    const handleTasksUpdated = () => {
      sessionStorage.removeItem("tasks");
      sessionStorage.removeItem("parent-tasks");
      fetchTasks();
      fetchParentTasks();
    };

    window.addEventListener("tasks-updated", handleTasksUpdated);

    return () => {
      window.removeEventListener("tasks-updated", handleTasksUpdated);
    };
  }, [session]);

  useEffect(() => {
    if (!isCreateTaskOpen) return;

    const fetchUsers = async () => {
      try {
        const cacheKey = "users";
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          const now = Date.now();
          if (now - parsed.timestamp < 300000) {
            setUsers(parsed.data.users || []);
            return;
          }
        }

        const response = await fetch("/api/users");
        if (response.ok) {
          const data = await response.json();
          setUsers(data.users || []);
          sessionStorage.setItem(
            cacheKey,
            JSON.stringify({ data, timestamp: Date.now() }),
          );
        }
      } catch (err) {
        console.error("Failed to fetch users:", err);
      }
    };

    const fetchDomains = async () => {
      try {
        const cacheKey = "domains";
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          const now = Date.now();
          if (now - parsed.timestamp < 300000) {
            setDomainsList(parsed.data.domains || []);
            return;
          }
        }

        const response = await fetch("/api/domains", {
          cache: "no-store",
        });
        if (response.ok) {
          const data = await response.json();
          setDomainsList(data.domains || []);
          sessionStorage.setItem(
            cacheKey,
            JSON.stringify({ data, timestamp: Date.now() }),
          );
        }
      } catch (err) {
        console.error("Failed to fetch domains:", err);
      }
    };

    const fetchParentTasks = async () => {
      try {
        const response = await fetch("/api/parent-tasks");
        if (response.ok) {
          const data = await response.json();
          setParentTasksList(data.parentTasks || []);
        }
      } catch (err) {
        console.error("Failed to fetch parent tasks:", err);
      }
    };

    fetchUsers();
    fetchDomains();
    fetchParentTasks();
  }, [isCreateTaskOpen]);

  const _handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        sessionStorage.removeItem("tasks");
        const refreshResponse = await fetch("/api/tasks", {
          next: { revalidate: 10 },
        });
        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          setTasks(data.tasks || []);
          sessionStorage.setItem(
            "tasks",
            JSON.stringify({ data, timestamp: Date.now() }),
          );
        }
      }
    } catch (err) {
      console.error("Failed to update task status:", err);
    }
  };

  const handleCollaboratorsClick = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    if (task.collaborators && task.collaborators.length > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      setSelectedTaskForCollaborators({
        task,
        position: {
          top: rect.bottom + 8,
          left: rect.left,
        },
      });
    }
  };

  // Get unique domains and topics for filters
  const { domains, topics } = useMemo(() => {
    const domainSet = new Set<string>();
    const topicSet = new Set<string>();
    tasks.forEach((task) => {
      domainSet.add(task.domain);
      topicSet.add(task.topic);
    });
    return {
      domains: Array.from(domainSet).sort(),
      topics: Array.from(topicSet).sort(),
    };
  }, [tasks]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch =
        searchQuery === "" ||
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.topic.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDomain =
        selectedDomain === "all" || task.domain === selectedDomain;
      const matchesTopic =
        selectedTopic === "all" || task.topic === selectedTopic;

      return matchesSearch && matchesDomain && matchesTopic;
    });
  }, [tasks, searchQuery, selectedDomain, selectedTopic]);



  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("taskId", taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    if (taskId && session?.user?.id) {
      try {
        const response = await fetch("/api/pinned-tasks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ taskId }),
        });

        if (response.ok) {
          setPinnedTasks((prev) => new Set([...prev, taskId]));
        }
      } catch (err) {
        console.error("Failed to add pinned task:", err);
      }
    }
  };

  const handleRemovePinned = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (session?.user?.id) {
      try {
        const response = await fetch(`/api/pinned-tasks?taskId=${taskId}`, {
          method: "DELETE",
        });

        if (response.ok) {
          setPinnedTasks((prev) => {
            const newSet = new Set(prev);
            newSet.delete(taskId);
            return newSet;
          });
        }
      } catch (err) {
        console.error("Failed to remove pinned task:", err);
      }
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setTasks((prevTasks) => prevTasks.filter((t) => t.id !== taskId));
    setPinnedTasks((prev) => {
      const newSet = new Set(prev);
      newSet.delete(taskId);
      return newSet;
    });
    if (selectedTask?.id === taskId) {
      setSelectedTask(null);
    }
    sessionStorage.removeItem("tasks");

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete task");
      }
      
      window.dispatchEvent(new Event("tasks-updated"));
      const fetchTasks = async () => {
        try {
          const response = await fetch("/api/tasks", {
            next: { revalidate: 0 },
          });
          if (response.ok) {
            const data = await response.json();
            setTasks(data.tasks || []);
            sessionStorage.setItem(
              "tasks",
              JSON.stringify({ data, timestamp: Date.now() }),
            );
          }
        } catch (err) {
          console.error("Failed to refresh tasks:", err);
        }
      };
      fetchTasks();
    } catch (err) {
      console.error("Failed to delete task:", err);
      sessionStorage.removeItem("tasks");
      window.dispatchEvent(new Event("tasks-updated"));
      const fetchTasks = async () => {
        try {
          const response = await fetch("/api/tasks", {
            next: { revalidate: 0 },
          });
          if (response.ok) {
            const data = await response.json();
            setTasks(data.tasks || []);
            sessionStorage.setItem(
              "tasks",
              JSON.stringify({ data, timestamp: Date.now() }),
            );
          }
        } catch (err) {
          console.error("Failed to refresh tasks:", err);
        }
      };
      fetchTasks();
      throw err;
    }
  };

  const handleDeleteParentTask = async (taskId: string) => {
    setParentTasks((prevTasks) => prevTasks.filter((t) => t.id !== taskId));
    if (selectedTask?.id === taskId) {
      setSelectedTask(null);
    }
    sessionStorage.removeItem("parent-tasks");

    try {
      const response = await fetch(`/api/parent-tasks/${taskId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete parent task");
      }
      
      window.dispatchEvent(new Event("tasks-updated"));
      const fetchParentTasks = async () => {
        try {
          const response = await fetch("/api/parent-tasks", {
            next: { revalidate: 0 },
          });
          if (response.ok) {
            const data = await response.json();
            setParentTasks(data.parentTasks || []);
            sessionStorage.setItem(
              "parent-tasks",
              JSON.stringify({ data, timestamp: Date.now() }),
            );
          }
        } catch (err) {
          console.error("Failed to refresh parent tasks:", err);
        }
      };
      fetchParentTasks();
    } catch (err) {
      console.error("Failed to delete parent task:", err);
      sessionStorage.removeItem("parent-tasks");
      window.dispatchEvent(new Event("tasks-updated"));
      const fetchParentTasks = async () => {
        try {
          const response = await fetch("/api/parent-tasks", {
            next: { revalidate: 0 },
          });
          if (response.ok) {
            const data = await response.json();
            setParentTasks(data.parentTasks || []);
            sessionStorage.setItem(
              "parent-tasks",
              JSON.stringify({ data, timestamp: Date.now() }),
            );
          }
        } catch (err) {
          console.error("Failed to refresh parent tasks:", err);
        }
      };
      fetchParentTasks();
      throw err;
    }
  };

  const handleOpenCreateTask = (domain?: string) => {
    setSelectedDomainForTask(domain || "");
    if (activeTab === "parent-tasks") {
      setCreateTaskMode("parent");
    } else {
      setCreateTaskMode("general");
    }
    setCreatedParentTaskId(null);
    setFormData({
      title: "",
      description: "",
      domain: domain || "",
      topic: "",
      section: "",
      leaderId: session?.user?.id || "",
      dueDate: "",
      priority: "medium",
      collaboratorIds: [],
      parentTaskId: "",
    });
    setIsCreateTaskOpen(true);
  };

  const handleCloseCreateTask = () => {
    setIsCreateTaskOpen(false);
    setSelectedDomainForTask("");
    setCreateTaskError("");
    setCreateTaskMode("parent");
    setCreatedParentTaskId(null);
    setFormData({
      title: "",
      description: "",
      domain: "",
      topic: "",
      section: "",
      leaderId: session?.user?.id || "",
      dueDate: "",
      priority: "medium",
      collaboratorIds: [],
      parentTaskId: "",
    });
  };

  const handleCreateTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateTaskError("");
    setCreateTaskLoading(true);

    try {
      if (activeTab === "parent-tasks") {
        const response = await fetch("/api/parent-tasks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            section: formData.section,
            domain: formData.domain,
            title: formData.title,
            topic: formData.topic,
            priority: formData.priority,
          }),
        });
        const data = await response.json();

        if (!response.ok) {
          setCreateTaskError(data.error || "משהו השתבש");
          setCreateTaskLoading(false);
          return;
        }

        sessionStorage.removeItem("parent-tasks");
        setCreateTaskLoading(false);
        handleCloseCreateTask();
        
        const refreshParentResponse = await fetch("/api/parent-tasks", {
          next: { revalidate: 0 },
        });
        if (refreshParentResponse.ok) {
          const refreshParentData = await refreshParentResponse.json();
          setParentTasks(refreshParentData.parentTasks || []);
          setParentTasksList(refreshParentData.parentTasks || []);
        }
        window.dispatchEvent(new Event("tasks-updated"));
      } else {
        const response = await fetch("/api/tasks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...formData,
            dueDate: formData.dueDate || null,
            isGeneral: createTaskMode === "general",
            parentTaskId: createTaskMode === "child" ? formData.parentTaskId : null,
            topic: createTaskMode === "general" ? (formData.topic || "כללי") : formData.topic,
          }),
        });
        const data = await response.json();

        if (!response.ok) {
          setCreateTaskError(data.error || "משהו השתבש");
          setCreateTaskLoading(false);
          return;
        }

        sessionStorage.removeItem("tasks");
        sessionStorage.removeItem("my-tasks");
        setCreateTaskLoading(false);
        handleCloseCreateTask();
        
        const refreshResponse = await fetch("/api/tasks", {
          next: { revalidate: 0 },
        });
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          setTasks(refreshData.tasks || []);
          sessionStorage.setItem(
            "tasks",
            JSON.stringify({ data: refreshData, timestamp: Date.now() }),
          );
        }
        window.dispatchEvent(new Event("tasks-updated"));
      }
    } catch {
      setCreateTaskError("משהו השתבש. נסה שוב.");
      setCreateTaskLoading(false);
    }
  };

  const handleCollaboratorToggle = (userId: string) => {
    setFormData((prev) => ({
      ...prev,
      collaboratorIds: prev.collaboratorIds.includes(userId)
        ? prev.collaboratorIds.filter((id) => id !== userId)
        : [...prev.collaboratorIds, userId],
    }));
  };

  if (!session) {
    return (
      <div className="container mx-auto py-8">
        <div className="rounded-lg border p-8 text-center">
          <h1 className="mb-4 text-2xl font-bold">ברוך הבא</h1>
          <p className="text-muted-foreground mb-6">
            עליך להתחבר כדי לצפות בלוח המשימות
          </p>
          <Link href="/login">
            <Button>התחבר</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">לוח משימות</h1>
            <div className="h-9 w-32 bg-gray-200 rounded-md animate-pulse" />
          </div>

          <div className="flex gap-2 border-b-2 border-gray-200">
            <div className="h-12 w-24 bg-gray-200 rounded-t-lg animate-pulse" />
            <div className="h-12 w-28 bg-gray-200 rounded-t-lg animate-pulse" />
          </div>

          <div className="h-10 bg-gray-100 rounded-md animate-pulse" />
        </div>

        <div className="flex gap-6">
          <div className="flex-shrink-0" style={{ width: "520px" }}>
            <div className="rounded-lg border bg-card p-4 animate-pulse">
              <div className="h-6 w-32 bg-gray-200 rounded mb-4" />
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-gray-100 rounded border" />
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1">
            <div className="flex gap-4 overflow-x-auto pb-4">
              {["מיצוב", "איתור"].map((section) => (
                <div
                  key={section}
                  className="flex min-w-[320px] max-w-[320px] flex-col rounded-lg border-2 border-gray-200 bg-gray-50 shadow-md"
                >
                  <div className="border-b-2 border-gray-200 bg-gray-100 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-20 bg-gray-300 rounded animate-pulse" />
                        <div className="h-6 w-8 bg-gray-300 rounded-full animate-pulse" />
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 space-y-3 overflow-y-auto p-4">
                    {[1, 2, 3].map((i) => (
                      <TaskCardSkeleton key={i} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-5">
      {/* Header with Tabs */}
      <div className="mb-5 space-y-3.5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">לוח משימות</h1>
          {((session?.user as any)?.role === "מפקד צוות" || (session?.user as any)?.role === "מנהל") && (
            <div className="flex gap-2">
              <Button 
                size="sm" 
                onClick={() => {
                  if (activeTab === "parent-tasks") {
                    setCreateTaskMode("parent");
                  } else {
                    setCreateTaskMode("general");
                  }
                  handleOpenCreateTask();
                }}
                className="h-9 shadow-sm"
              >
                <Icons.plus className="ml-1.5 h-4 w-4" />
                {activeTab === "parent-tasks" ? "משימת אב חדשה" : "משימה חדשה"}
              </Button>
            </div>
          )}
        </div>

        <div className="flex gap-1 border-b border-border">
          <button
            onClick={() => setActiveTab("tasks")}
            className={`px-4 py-2 font-medium text-sm transition-all ${
              activeTab === "tasks"
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            משימות
          </button>
          <button
            onClick={() => setActiveTab("parent-tasks")}
            className={`px-4 py-2 font-medium text-sm transition-all ${
              activeTab === "parent-tasks"
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            משימות אב
          </button>
        </div>

        {activeTab === "tasks" && (
          <SearchAndFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedDomain={selectedDomain}
            onDomainChange={setSelectedDomain}
            selectedTopic={selectedTopic}
            onTopicChange={setSelectedTopic}
            domains={domains}
            topics={topics}
          />
        )}
      </div>

      {/* Main Layout with Sidebar and Kanban */}
      <div className="flex gap-4">
        {activeTab === "tasks" && (
          <div className="flex-shrink-0" style={{ width: "500px", minWidth: "500px" }}>
            <PinnedTasksSidebar
              pinnedTasks={pinnedTasks}
              allTasks={filteredTasks}
              activeTab={pinnedTasksTab}
              onTabChange={setPinnedTasksTab}
              onTaskClick={setSelectedTask}
              onRemovePinned={handleRemovePinned}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            />
          </div>
        )}

        <div className={activeTab === "tasks" ? "flex-1 min-w-0" : "w-full"}>
          {activeTab === "tasks" ? (
            filteredTasks.length === 0 ? (
              <div className="rounded-lg border bg-card p-12 text-center">
                <p className="text-muted-foreground mb-4">
                  {searchQuery || selectedDomain !== "all" || selectedTopic !== "all"
                    ? "לא נמצאו משימות התואמות לחיפוש"
                    : "אין משימות עדיין"}
                </p>
                {(!searchQuery && selectedDomain === "all" && selectedTopic === "all") && (
                  <Button onClick={() => {
                    setCreateTaskMode("general");
                    handleOpenCreateTask();
                  }}>
                    צור משימה ראשונה
                  </Button>
                )}
              </div>
            ) : (
              <KanbanBoard
                tasks={filteredTasks}
                onTaskClick={setSelectedTask}
                onCollaboratorsClick={handleCollaboratorsClick}
                onCreateTask={(domain) => {
                  setCreateTaskMode("general");
                  handleOpenCreateTask(domain);
                }}
                onDragStart={handleDragStart}
                showCreateButton={true}
              />
            )
          ) : parentTasks.length === 0 ? (
            <div className="rounded-lg border bg-card p-12 text-center">
              <p className="text-muted-foreground mb-4">
                אין משימות אב עדיין
              </p>
              <Button onClick={() => {
                setCreateTaskMode("parent");
                handleOpenCreateTask();
              }}>
                צור משימת אב ראשונה
              </Button>
            </div>
          ) : (
            <div className="w-full">
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                {(() => {
                  const sectionOrder = ["מיצוב", "איתור", "כללי"];
                  const tasksBySection = parentTasks.reduce((acc, parentTask) => {
                    const section = parentTask.section || "כללי";
                    if (!acc[section]) {
                      acc[section] = [];
                    }
                    acc[section].push(parentTask);
                    return acc;
                  }, {} as Record<string, typeof parentTasks>);

                  return sectionOrder.map((section) => {
                    const sectionTasks = tasksBySection[section] || [];
                    const sortedTasks = [...sectionTasks].sort((a, b) => 
                      (a.title || "").localeCompare(b.title || "", "he")
                    );

                    return (
                      <div key={section} className="flex-shrink-0 w-full md:w-[320px] lg:w-[360px] space-y-4">
                        <div className="sticky top-0 bg-background z-10 pb-3 mb-4 border-b-2 border-border">
                          <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-foreground">
                              {section}
                            </h2>
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                              {sortedTasks.length}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-4 pr-2">
                          {sortedTasks.map((parentTask) => {
                            const childTasksForParent = tasks.filter(t => t.parentTaskId === parentTask.id);
                            return (
                              <ParentTaskCard
                                key={parentTask.id}
                                parentTask={parentTask}
                                childTasks={childTasksForParent}
                                onClick={async () => {
                                  const parentTaskAsTask: Task = {
                                    id: parentTask.id,
                                    title: parentTask.title,
                                    description: null,
                                    parentTaskId: null,
                                    parentTitle: null,
                                    section: parentTask.section,
                                    isGeneral: false,
                                    domain: parentTask.domain,
                                    topic: parentTask.topic,
                                    leaderId: parentTask.createdByUserId,
                                    leader_name: parentTask.createdBy_name,
                                    leader_email: parentTask.createdBy_email,
                                    dueDate: null,
                                    priority: parentTask.priority,
                                    status: "pending",
                                    createdAt: parentTask.createdAt,
                                    collaborators: [],
                                    discussionCount: parentTask.discussionCount,
                                    hasUnreadDiscussion: parentTask.hasUnreadDiscussion,
                                  };
                                  (parentTaskAsTask as any).isParentTask = true;
                                  setSelectedTask(parentTaskAsTask);
                                }}
                                childTasksCount={childTasksForParent.length}
                                onChildTaskClick={setSelectedTask}
                                onChildCollaboratorsClick={handleCollaboratorsClick}
                              />
                            );
                          })}
                          {sortedTasks.length === 0 && (
                            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-12 text-center">
                              <p className="text-sm text-muted-foreground">
                                אין משימות אב במדור זה
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedTaskForCollaborators && (
        <CollaboratorsPopup
          task={selectedTaskForCollaborators.task}
          position={selectedTaskForCollaborators.position}
          onClose={() => setSelectedTaskForCollaborators(null)}
          onCollaboratorAdded={(collaborator) => {
            setTasks((prevTasks) =>
              prevTasks.map((t) =>
                t.id === selectedTaskForCollaborators.task.id
                  ? {
                      ...t,
                      collaborators: [
                        ...(t.collaborators || []),
                        collaborator,
                      ],
                    }
                  : t
              )
            );
            if (selectedTask && selectedTask.id === selectedTaskForCollaborators.task.id) {
              setSelectedTask({
                ...selectedTask,
                collaborators: [
                  ...(selectedTask.collaborators || []),
                  collaborator,
                ],
              });
            }
            setSelectedTaskForCollaborators({
              ...selectedTaskForCollaborators,
              task: {
                ...selectedTaskForCollaborators.task,
                collaborators: [
                  ...(selectedTaskForCollaborators.task.collaborators || []),
                  collaborator,
                ],
              },
            });
          }}
          onCollaboratorRemoved={(userId) => {
            setTasks((prevTasks) =>
              prevTasks.map((t) =>
                t.id === selectedTaskForCollaborators.task.id
                  ? {
                      ...t,
                      collaborators: (t.collaborators || []).filter(
                        (c) => c.id !== userId
                      ),
                    }
                  : t
              )
            );
            if (selectedTask && selectedTask.id === selectedTaskForCollaborators.task.id) {
              setSelectedTask({
                ...selectedTask,
                collaborators: (selectedTask.collaborators || []).filter(
                  (c) => c.id !== userId
                ),
              });
            }
            setSelectedTaskForCollaborators({
              ...selectedTaskForCollaborators,
              task: {
                ...selectedTaskForCollaborators.task,
                collaborators: (selectedTaskForCollaborators.task.collaborators || []).filter(
                  (c) => c.id !== userId
                ),
              },
            });
          }}
        />
      )}

      {selectedTask && (
        <TaskDetailsPopup
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onCollaboratorsClick={handleCollaboratorsClick}
          onDelete={(() => {
            const isParentTask = (selectedTask as any).isParentTask || parentTasks.some(pt => pt.id === selectedTask.id);
            return isParentTask ? handleDeleteParentTask : handleDeleteTask;
          })()}
          onStatusChange={(taskId, newStatus) => {
            setTasks((prevTasks) =>
              prevTasks.map((t) =>
                t.id === taskId ? { ...t, status: newStatus } : t
              )
            );
            if (selectedTask.id === taskId) {
              setSelectedTask((prev) => ({ ...prev, status: newStatus }));
            }
            sessionStorage.removeItem("tasks");
            sessionStorage.removeItem("my-tasks");
            window.dispatchEvent(new Event("tasks-updated"));
          }}
        />
      )}

      {/* Create Task Popup */}
      {isCreateTaskOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={handleCloseCreateTask}
          onKeyDown={(e) => e.key === "Escape" && handleCloseCreateTask()}
          role="button"
          tabIndex={0}
        >
          <div
            className="relative rounded-xl border border-border bg-background p-6 shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="dialog"
            tabIndex={-1}
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">יצירת משימה חדשה</h2>
              <button
                onClick={handleCloseCreateTask}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="סגור"
              >
                <Icons.x className="h-5 w-5" />
              </button>
            </div>

            {activeTab === "parent-tasks" ? (
              <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm text-blue-800">
                  יצירת משימת אב חדשה
                </p>
              </div>
            ) : (
              <div className="mb-6 flex gap-2 border-b-2 border-gray-200 pb-4">
                <button
                  type="button"
                  onClick={() => {
                    setCreateTaskMode("child");
                    setFormData(prev => ({ ...prev, parentTaskId: "" }));
                  }}
                  className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm ${
                    createTaskMode === "child"
                      ? "bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md hover:shadow-lg"
                      : "bg-gray-100 text-gray-700 hover:bg-green-50 hover:text-green-700 hover:border-green-300 border-2 border-transparent"
                  }`}
                >
                  משימת בן
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreateTaskMode("general");
                    setFormData(prev => ({ ...prev, parentTaskId: "", section: "", topic: "" }));
                  }}
                  className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm ${
                    createTaskMode === "general"
                      ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md hover:shadow-lg"
                      : "bg-gray-100 text-gray-700 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300 border-2 border-transparent"
                  }`}
                >
                  משימה כללית
                </button>
              </div>
            )}

            <form onSubmit={handleCreateTaskSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="create-title" className="text-sm font-medium">
                  כותרת המשימה *
                </label>
                <Input
                  id="create-title"
                  type="text"
                  placeholder="הכנס כותרת למשימה"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="create-description" className="text-sm font-medium">
                  תיאור
                </label>
                <textarea
                  id="create-description"
                  className="border-input placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[100px] w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm [dir=ltr]:text-left [dir=rtl]:text-right"
                  placeholder="הכנס תיאור מפורט של המשימה"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>

              {/* Section (for parent tasks and general tasks) */}
              {(activeTab === "parent-tasks" || (activeTab === "tasks" && createTaskMode === "general")) && (
                <div className="space-y-2">
                  <label htmlFor="create-section" className="text-sm font-medium">
                    מדור {activeTab === "parent-tasks" ? "*" : "(אופציונלי)"}
                  </label>
                  <Select
                    id="create-section"
                    value={formData.section}
                    onChange={(e) => {
                      setFormData({ ...formData, section: e.target.value, topic: "" });
                    }}
                    required={activeTab === "parent-tasks"}
                  >
                    <option value="">בחר מדור</option>
                    {SECTION_OPTIONS.map((section) => (
                      <option key={section} value={section}>
                        {section}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {/* Parent task selector (for child tasks only) */}
              {activeTab === "tasks" && createTaskMode === "child" && (
                <div className="space-y-2">
                  <label htmlFor="create-parent-task" className="text-sm font-medium">
                    משימת אב *
                  </label>
                  <Select
                    id="create-parent-task"
                    value={formData.parentTaskId}
                    onChange={(e) => {
                      const selectedParent = parentTasksList.find((pt) => pt.id === e.target.value);
                      setFormData({
                        ...formData,
                        parentTaskId: e.target.value,
                        domain: selectedParent?.domain || formData.domain,
                        section: selectedParent?.section || formData.section,
                        topic: selectedParent?.topic || formData.topic,
                      });
                    }}
                    required
                  >
                    <option value="">בחר משימת אב</option>
                    {parentTasksList
                      .filter(pt => !formData.domain || pt.domain === formData.domain)
                      .map((pt) => (
                        <option key={pt.id} value={pt.id}>
                          {pt.title} ({pt.section} - {pt.topic})
                        </option>
                      ))}
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="create-domain" className="text-sm font-medium">
                    תחום *
                  </label>
                  <Select
                    id="create-domain"
                    value={formData.domain}
                    onChange={(e) =>
                      setFormData({ ...formData, domain: e.target.value })
                    }
                    required
                    disabled={((createTaskMode === "child" || createdParentTaskId) && !!formData.parentTaskId) || false}
                  >
                    <option value="">בחר תחום</option>
                    {domainsList.map((domain) => (
                      <option key={domain.id} value={domain.name}>
                        {domain.name}
                      </option>
                    ))}
                  </Select>
                </div>

                {activeTab === "parent-tasks" ? (
                  <div className="space-y-2">
                    <label htmlFor="create-topic" className="text-sm font-medium">
                      נושא *
                    </label>
                    {formData.section ? (
                      <Select
                        id="create-topic"
                        value={formData.topic}
                        onChange={(e) =>
                          setFormData({ ...formData, topic: e.target.value })
                        }
                        required
                      >
                        <option value="">בחר נושא</option>
                        {TOPICS_BY_SECTION[formData.section as keyof typeof TOPICS_BY_SECTION]?.map((topic) => (
                          <option key={topic} value={topic}>
                            {topic}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Input
                        id="create-topic"
                        type="text"
                        placeholder="בחר מדור קודם"
                        value={formData.topic}
                        disabled
                      />
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label htmlFor="create-topic" className="text-sm font-medium">
                      נושא {createTaskMode === "general" ? "(אופציונלי)" : "*"}
                    </label>
                    <Input
                      id="create-topic"
                      type="text"
                      placeholder={createTaskMode === "general" ? "אופציונלי" : "הכנס נושא ספציפי"}
                      value={formData.topic}
                      onChange={(e) =>
                        setFormData({ ...formData, topic: e.target.value })
                      }
                      required={createTaskMode !== "general"}
                      disabled={createTaskMode === "child" && !!formData.parentTaskId}
                    />
                  </div>
                )}
              </div>

              {activeTab === "tasks" && (
                <>
                  <div className="space-y-2">
                    <label htmlFor="create-leader" className="text-sm font-medium">
                      מוביל המשימה *
                    </label>
                    <Select
                      id="create-leader"
                      value={formData.leaderId}
                      onChange={(e) =>
                        setFormData({ ...formData, leaderId: e.target.value })
                      }
                      required
                    >
                      <option value="">בחר מוביל</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name || user.email}
                          {user.email ? ` (${user.email})` : ""}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="create-dueDate" className="text-sm font-medium">
                      תאריך יעד (אופציונלי)
                    </label>
                    <Input
                      id="create-dueDate"
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) =>
                        setFormData({ ...formData, dueDate: e.target.value })
                      }
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <label htmlFor="create-priority" className="text-sm font-medium">
                  רמת דחיפות *
                </label>
                <Select
                  id="create-priority"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: e.target.value })
                  }
                  required
                >
                  <option value="low">נמוכה</option>
                  <option value="medium">בינונית</option>
                  <option value="high">גבוהה</option>
                </Select>
              </div>

              {activeTab === "tasks" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">שותפים למשימה</label>
                  <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-4">
                    {users.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        אין משתמשים זמינים
                      </p>
                    ) : (
                      users.map((user) => (
                        <label
                          key={user.id}
                          className="flex cursor-pointer items-center gap-2"
                        >
                          <input
                            type="checkbox"
                            checked={formData.collaboratorIds.includes(user.id)}
                            onChange={() => handleCollaboratorToggle(user.id)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <span className="text-sm">{user.name || user.email}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}

              {createTaskError && (
                <div className="text-destructive text-sm">{createTaskError}</div>
              )}

              <div className="flex gap-4">
                <Button 
                  type="submit" 
                  className={`flex-1 font-bold shadow-md hover:shadow-lg transition-all ${
                    activeTab === "parent-tasks"
                      ? "bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white"
                      : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
                  }`}
                  disabled={createTaskLoading}
                >
                  {createTaskLoading 
                    ? "יוצר משימה..." 
                    : activeTab === "parent-tasks"
                      ? "צור משימת אב" 
                      : "צור משימה"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-2 border-gray-300 hover:bg-gray-50 font-medium"
                  onClick={handleCloseCreateTask}
                >
                  ביטול
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
