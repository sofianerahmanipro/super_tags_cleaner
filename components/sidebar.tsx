"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Tag, FileCode, BrushCleaning } from "lucide-react";
import { ModeToggle } from "@/components/theme-toggle-mode";
import { VersionDisplay } from "@/components/version-display";

const navItems = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/clean-tags", label: "Clean My Tags", icon: Tag },
  { href: "/clean-syntax", label: "Clean My Syntaxe", icon: FileCode },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-55 flex flex-col border-r border-border bg-card z-10">
      <div className="flex items-center gap-3 px-5 py-6 border-b border-border">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg text-white font-bold text-sm select-none" style={{ backgroundColor: "var(--accent-orange)" }}>
          <BrushCleaning />
        </div>
        <span className="text-foreground font-semibold text-sm leading-tight">
          Super Tags
          <br />
          Cleaner
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={`
                relative flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors
                ${
                  isActive
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }
              `}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r" style={{ backgroundColor: "var(--accent-orange)" }} />
              )}
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center justify-between px-5 py-4 border-t border-border">
        <VersionDisplay />
        <ModeToggle />
      </div>
    </aside>
  );
}
