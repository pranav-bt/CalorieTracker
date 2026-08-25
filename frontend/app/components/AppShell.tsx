"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ChefHat,
  Home,
  Settings,
  Target,
  PackageOpen,
  Dumbbell,
} from "lucide-react";
import { LoveNotePopup } from "./LoveNotePopup";
import { getLoveNote } from "../db";
import { APP_DISPLAY_NAME, IS_DEVELOPMENT_BUILD } from "../appConfig";

const navItems = [
  { href: "/", label: "Home", shortLabel: "Home", icon: Home },
  { href: "/foods", label: "Food Database", shortLabel: "Foods", icon: BookOpen },
  { href: "/inventory", label: "Inventory", shortLabel: "Pantry", icon: PackageOpen },
  { href: "/recipes", label: "Recipes", shortLabel: "Recipes", icon: ChefHat },
  { href: "/plan", label: "Plan", shortLabel: "Plan", icon: Target },
  { href: "/routine", label: "Routine", shortLabel: "Meals", icon: CalendarDays },
  { href: "/workout", label: "Workout", shortLabel: "Train", icon: Dumbbell },
  { href: "/history", label: "History", shortLabel: "History", icon: CalendarDays },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [loveNote, setLoveNote] = useState<string | null>(null);

  useEffect(() => {
    const text = getLoveNote();
    const timer = setTimeout(() => setLoveNote(text), 45_000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="appShell">
      <aside className="sideNav">
        <div className="brand">
          <BarChart3 size={22} />
          <span>{APP_DISPLAY_NAME}</span>
          {IS_DEVELOPMENT_BUILD && <small className="buildChannelBadge">DEV</small>}
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
      <nav className="mobileNav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={isActive ? "mobileNavLink active" : "mobileNavLink"}
              href={item.href}
              key={item.href}
            >
              <Icon size={22} />
              <span>{item.shortLabel}</span>
            </Link>
          );
        })}
      </nav>
      {loveNote && (
        <LoveNotePopup message={loveNote} onDismiss={() => setLoveNote(null)} />
      )}
    </div>
  );
}
