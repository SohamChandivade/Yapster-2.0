"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { ChartIcon, GlobeIcon, HomeIcon, PersonIcon } from "./icons";

const items = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/scenarios", label: "Scenarios", Icon: GlobeIcon },
  { href: "/progress", label: "Progress", Icon: ChartIcon },
  { href: "/profile", label: "Profile", Icon: PersonIcon },
] as const;

/** Floating glass pill above the home indicator. */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 14px)" }}
    >
      <div className="glass-strong pointer-events-auto flex h-16 items-center gap-1 rounded-pill px-2 shadow-[0_12px_32px_-16px_rgba(28,27,26,0.28)]">
        {items.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className="relative flex h-12 w-[62px] items-center justify-center rounded-pill"
            >
              {active && (
                <motion.span
                  layoutId="bottom-nav-active"
                  className="absolute inset-0 rounded-pill bg-ink/8"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <Icon
                className={cn(
                  "relative h-[22px] w-[22px] transition-colors duration-200",
                  active ? "text-ink" : "text-ink-muted",
                )}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
