"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

import { Avatar } from "@/components/avatar";
import { Icons } from "@/components/icons";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { cn } from "@/lib/utils";

export const Sidebar = () => {
  const pathname = usePathname();
  const { data: session } = useSession();

  const navItems = [
    {
      title: "לוח משימות",
      href: "/",
      icon: Icons.dashboard,
      requiresAuth: true,
    },
    {
      title: "משימות שלי",
      href: "/tasks/my",
      icon: Icons.myTasks,
      requiresAuth: true,
    },
    {
      title: "משתמשים",
      href: "/users",
      icon: Icons.users,
      requiresAuth: true,
    },
  ];

  if (!session) {
    return null;
  }

  return (
    <aside
      data-sidebar
      className={cn(
        "bg-sidebar fixed top-0 z-30 h-screen w-64 border-l border-sidebar-border transition-transform",
        "right-0",
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-14 items-center border-b border-sidebar-border px-5">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            מערכת משימות
          </Link>
        </div>

        <nav className="flex-1 space-y-0.5 p-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-md px-3 py-2.5 bg-sidebar-accent/30 mb-3">
            <Avatar
              name={session.user?.name || null}
              email={session.user?.email || ""}
              image={session.user?.image || null}
              size="md"
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate text-sidebar-foreground">
                {session.user?.name || session.user?.email || "משתמש"}
              </p>
              {session.user?.name && (
                <p className="text-sidebar-foreground/60 text-xs truncate">
                  {session.user?.email}
                </p>
              )}
              {(session.user as any)?.role && (
                <p className="text-sidebar-foreground/60 text-xs mt-0.5">
                  {(session.user as any)?.role}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="התנתק"
              onClick={async () => await signOut({ callbackUrl: "/login" })}
              className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
            >
              <Icons.logOut className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant={pathname === "/settings" ? "default" : "ghost"}
              size="icon"
              aria-label="הגדרות"
              className={cn(
                "h-9 w-9",
                pathname === "/settings" 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                  : "hover:bg-sidebar-accent/50 text-sidebar-foreground/70"
              )}
            >
              <Link href="/settings">
                <Icons.settings className="h-4 w-4" />
              </Link>
            </Button>
            <ThemeSwitcher />
          </div>
        </div>
      </div>
    </aside>
  );
};
