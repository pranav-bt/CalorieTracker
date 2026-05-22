"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Home,
  Plus,
  Settings,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/log-meal", label: "Log Meal", icon: Plus },
  { href: "/foods", label: "Food Database", icon: BookOpen },
  { href: "/goals", label: "Goals", icon: Settings },
  { href: "/history", label: "History", icon: CalendarDays },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="appShell">
      <aside className="sideNav">
        <div className="brand">
          <BarChart3 size={22} />
          <span>Calorie Tracker</span>
        </div>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={isActive ? "navLink active" : "navLink"}
                href={item.href}
                key={item.href}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="pageShell">{children}</main>
    </div>
  );
}

