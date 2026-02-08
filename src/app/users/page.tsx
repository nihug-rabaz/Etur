"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Icons } from "@/components/icons";
import { SECTION_OPTIONS, TOPICS_BY_SECTION } from "@/lib/topics";

type User = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  isActive: boolean;
  role: string;
};

type UserTopic = {
  section: string;
  topic: string;
};

export default function UsersPage() {
  const { data: session, update } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>("");
  const [userTopics, setUserTopics] = useState<Record<string, UserTopic[]>>({});
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [addingTopic, setAddingTopic] = useState<string | null>(null);
  const [newTopicSection, setNewTopicSection] = useState<string>("");
  const [newTopicTopic, setNewTopicTopic] = useState<string>("");

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const cacheKey = "users";
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          const now = Date.now();
          if (now - parsed.timestamp < 300000) {
            setUsers(parsed.data.users || []);
            setLoading(false);
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

          // Fetch user topics for all users (if manager)
          const userRole = (session?.user as any)?.role || "חפ״ש";
          if (userRole === "מנהל") {
            const topicsPromises = data.users.map(async (user: User) => {
              try {
                const topicsResponse = await fetch(`/api/users/${user.id}/topics`);
                if (topicsResponse.ok) {
                  const topicsData = await topicsResponse.json();
                  return { userId: user.id, topics: topicsData.userTopics || [] };
                }
              } catch (err) {
                console.error(`Failed to fetch topics for user ${user.id}:`, err);
              }
              return { userId: user.id, topics: [] };
            });
            const topicsResults = await Promise.all(topicsPromises);
            const topicsMap: Record<string, UserTopic[]> = {};
            topicsResults.forEach(({ userId, topics }) => {
              topicsMap[userId] = topics;
            });
            setUserTopics(topicsMap);
          }
        }
      } catch (err) {
        console.error("Failed to fetch users:", err);
      } finally {
        setLoading(false);
      }
    };

    if (session) {
      fetchUsers();
      setCurrentUserRole((session.user as any)?.role || "חפ״ש");
    }
  }, [session]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingRole(userId);
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "משהו השתבש");
        return;
      }

      sessionStorage.removeItem("users");
      const refreshResponse = await fetch("/api/users");
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        setUsers(refreshData.users || []);
        sessionStorage.setItem(
          "users",
          JSON.stringify({ data: refreshData, timestamp: Date.now() }),
        );
      }

      if (userId === session?.user?.id) {
        await update();
        setCurrentUserRole(newRole);
      }
    } catch (err) {
      console.error("Failed to update user role:", err);
      alert("משהו השתבש. נסה שוב.");
    } finally {
      setUpdatingRole(null);
    }
  };

  const handleAddTopic = async (userId: string) => {
    if (!newTopicSection || !newTopicTopic) {
      alert("נא לבחור מדור ונושא");
      return;
    }

    setAddingTopic(userId);
    try {
      const response = await fetch(`/api/users/${userId}/topics`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          section: newTopicSection,
          topic: newTopicTopic,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || "משהו השתבש");
        return;
      }

      // Refresh user topics
      const topicsResponse = await fetch(`/api/users/${userId}/topics`);
      if (topicsResponse.ok) {
        const topicsData = await topicsResponse.json();
        setUserTopics((prev) => ({
          ...prev,
          [userId]: topicsData.userTopics || [],
        }));
      }

      setNewTopicSection("");
      setNewTopicTopic("");
      setAddingTopic(null);
    } catch (err) {
      console.error("Failed to add topic:", err);
      alert("משהו השתבש. נסה שוב.");
    } finally {
      setAddingTopic(null);
    }
  };

  const handleRemoveTopic = async (userId: string, section: string, topic: string) => {
    if (!confirm(`האם אתה בטוח שברצונך להסיר את הנושא ${section} - ${topic}?`)) {
      return;
    }

    try {
      const response = await fetch(
        `/api/users/${userId}/topics?section=${encodeURIComponent(section)}&topic=${encodeURIComponent(topic)}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || "משהו השתבש");
        return;
      }

      // Refresh user topics
      const topicsResponse = await fetch(`/api/users/${userId}/topics`);
      if (topicsResponse.ok) {
        const topicsData = await topicsResponse.json();
        setUserTopics((prev) => ({
          ...prev,
          [userId]: topicsData.userTopics || [],
        }));
      }
    } catch (err) {
      console.error("Failed to remove topic:", err);
      alert("משהו השתבש. נסה שוב.");
    }
  };

  const isManager = currentUserRole === "מנהל";

  if (!session) {
    return (
      <div className="container mx-auto py-8">
        <div className="rounded-lg border p-8 text-center">
          <h1 className="mb-4 text-2xl font-bold">נדרשת התחברות</h1>
          <p className="text-muted-foreground mb-6">
            עליך להתחבר כדי לצפות במשתמשים
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <p className="text-muted-foreground">טוען משתמשים...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">ניהול משתמשים</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          רשימת כל המשתמשים במערכת
        </p>
      </div>

      {users.length === 0 ? (
        <div className="rounded-lg border p-8 text-center">
          <p className="text-muted-foreground">אין משתמשים במערכת</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-6 py-3 text-right text-sm font-semibold">
                    משתמש
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-semibold">
                    אימייל
                  </th>
                  <th className="px-6 py-3 text-center text-sm font-semibold">
                    תפקיד
                  </th>
                  <th className="px-6 py-3 text-center text-sm font-semibold">
                    סטטוס
                  </th>
                  {isManager && (
                    <th className="px-6 py-3 text-center text-sm font-semibold">
                      נושאים
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <React.Fragment key={user.id}>
                    <tr
                      className="border-b transition-colors hover:bg-muted/50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={user.name}
                            email={user.email}
                            image={user.image}
                            size="md"
                          />
                          <div>
                            <p className="font-medium">
                              {user.name || "ללא שם"}
                            </p>
                            {user.name && (
                              <p className="text-muted-foreground text-sm">
                                {user.email}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm">{user.email}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {isManager ? (
                          <Select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            disabled={updatingRole === user.id}
                            className="min-w-[100px]"
                          >
                            <option value="חפ״ש">חפ״ש</option>
                            <option value="מפקד צוות">מפקד צוות</option>
                            <option value="מנהל">מנהל</option>
                          </Select>
                        ) : (
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              user.role === "מנהל"
                                ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                                : user.role === "מפקד צוות"
                                ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                            }`}
                          >
                            {user.role}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            user.isActive
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                          }`}
                        >
                          {user.isActive ? "פעיל" : "לא פעיל"}
                        </span>
                      </td>
                      {isManager && (
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {expandedUser === user.id ? (
                              <Icons.x className="h-4 w-4" />
                            ) : (
                              <Icons.plus className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                      )}
                    </tr>
                    {isManager && expandedUser === user.id && (
                      <tr key={`${user.id}-topics`} className="border-b bg-muted/20">
                        <td colSpan={5} className="px-6 py-4">
                          <div className="space-y-4">
                            <div>
                              <h4 className="text-sm font-semibold mb-2">נושאים משויכים</h4>
                              {userTopics[user.id] && userTopics[user.id].length > 0 ? (
                                <div className="flex flex-wrap gap-2 mb-4">
                                  {userTopics[user.id].map((ut, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                    >
                                      {ut.section} - {ut.topic}
                                      <button
                                        onClick={() => handleRemoveTopic(user.id, ut.section, ut.topic)}
                                        className="hover:text-red-600 transition-colors"
                                      >
                                        <Icons.x className="h-3 w-3" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-muted-foreground text-sm mb-4">אין נושאים משויכים</p>
                              )}
                            </div>
                            <div className="border-t pt-4">
                              <h4 className="text-sm font-semibold mb-2">הוסף נושא</h4>
                              <div className="flex gap-2">
                                <Select
                                  value={newTopicSection}
                                  onChange={(e) => {
                                    setNewTopicSection(e.target.value);
                                    setNewTopicTopic("");
                                  }}
                                  className="min-w-[150px]"
                                >
                                  <option value="">בחר מדור</option>
                                  {SECTION_OPTIONS.map((section) => (
                                    <option key={section} value={section}>
                                      {section}
                                    </option>
                                  ))}
                                </Select>
                                {newTopicSection && (
                                  <Select
                                    value={newTopicTopic}
                                    onChange={(e) => setNewTopicTopic(e.target.value)}
                                    className="min-w-[150px]"
                                  >
                                    <option value="">בחר נושא</option>
                                    {TOPICS_BY_SECTION[newTopicSection as keyof typeof TOPICS_BY_SECTION]?.map((topic) => (
                                      <option key={topic} value={topic}>
                                        {topic}
                                      </option>
                                    ))}
                                  </Select>
                                )}
                                <Button
                                  size="sm"
                                  onClick={() => handleAddTopic(user.id)}
                                  disabled={!newTopicSection || !newTopicTopic || addingTopic === user.id}
                                >
                                  {addingTopic === user.id ? "מוסיף..." : "הוסף"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-4 text-sm text-muted-foreground">
        סה"כ {users.length} משתמש{users.length !== 1 ? "ים" : ""}
      </div>
    </div>
  );
}
