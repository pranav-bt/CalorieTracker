import Link from "next/link";
import { BookOpen, ChefHat, Gift, History, PackageOpen, Settings } from "lucide-react";

const sections = [
  { href: "/foods", title: "Food database", detail: "Nutrition references and label scans", icon: BookOpen },
  { href: "/inventory", title: "Inventory", detail: "Pantry stock and expiry dates", icon: PackageOpen },
  { href: "/recipes", title: "Recipes", detail: "Recipe nutrition and optional AI handoff", icon: ChefHat },
  { href: "/heart-points", title: "Rewards", detail: "Points, catalogue, and redemptions", icon: Gift },
  { href: "/history", title: "History & backup", detail: "Logged days, data backup, and restore", icon: History },
  { href: "/settings", title: "Settings", detail: "Goals, rewards, prompts, and preferences", icon: Settings },
];

export default function MorePage() {
  return <section className="pageStack">
    <div className="pageHeader"><div><p className="eyebrow">App sections</p><h1>More</h1></div></div>
    <div className="moreGrid">{sections.map((section) => {
      const Icon = section.icon;
      return <Link className="panel moreCard" href={section.href} key={section.href}><Icon size={22} /><div><h2>{section.title}</h2><p>{section.detail}</p></div></Link>;
    })}</div>
  </section>;
}
