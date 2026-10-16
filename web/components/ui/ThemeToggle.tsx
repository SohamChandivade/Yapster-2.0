"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { type ThemeChoice, useTheme } from "@/lib/theme";
import { MoonIcon, SunIcon } from "./icons";

const options: { value: ThemeChoice; label: string; Icon?: typeof SunIcon }[] = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "system", label: "Auto" },
];

/** Segmented glass pill: Light / Dark / Auto. */
export function ThemeToggle({ className }: { className?: string }) {
  const [choice, setChoice] = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className={cn("glass flex h-12 items-center rounded-pill p-1", className)}
    >
      {options.map(({ value, label, Icon }) => {
        const active = choice === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setChoice(value)}
            className={cn(
              "relative flex h-10 flex-1 items-center justify-center gap-1.5 rounded-pill text-[13px] font-medium",
              "transition-colors duration-200",
              active ? "text-ink" : "text-ink-muted",
            )}
          >
            {active && (
              <motion.span
                layoutId="theme-active"
                className="absolute inset-0 rounded-pill bg-ink/8"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            {Icon && <Icon className="relative h-4 w-4" />}
            <span className="relative">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
