"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Heart,
  Home,
  Plus,
  Settings,
} from "lucide-react";
import { LoveNotePopup } from "./LoveNotePopup";
import { API_BASE_URL } from "../config";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/log-meal", label: "Log Meal", icon: Plus },
  { href: "/foods", label: "Food Database", icon: BookOpen },
  { href: "/goals", label: "Goals", icon: Settings },
  { href: "/history", label: "History", icon: CalendarDays },
  { href: "/heart-points", label: "Heart Points", icon: Heart },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [loveNote, setLoveNote] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAndSchedule() {
      try {
        const response = await fetch(`${API_BASE_URL}/love-note`);
        if (!response.ok) return;
        const { text } = await response.json();
        const timer = setTimeout(() => setLoveNote(text), 45_000);
        return () => clearTimeout(timer);
      } catch {
        // silently ignore if backend unreachable
      }
    }
    fetchAndSchedule();
  }, []);

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
      {loveNote && (
        <LoveNotePopup message={loveNote} onDismiss={() => setLoveNote(null)} />
      )}
    </div>
  );
}

