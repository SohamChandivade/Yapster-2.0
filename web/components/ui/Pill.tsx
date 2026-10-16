import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "solid" | "glass" | "ghost";
type Size = "sm" | "md" | "lg";

const variantClass: Record<Variant, string> = {
  solid: "bg-ink text-bg",
  glass: "glass-strong text-ink",
  ghost: "text-ink",
};

const sizeClass: Record<Size, string> = {
  sm: "h-9 px-4 text-[13px]",
  md: "h-12 px-6 text-[15px]",
  lg: "h-14 px-7 text-[16px]",
};

function pillClass(variant: Variant, size: Size, className?: string) {
  return cn(
    "inline-flex select-none items-center justify-center gap-2 rounded-pill font-medium",
    "transition-[transform,opacity] duration-200 ease-out active:scale-[0.98] active:opacity-90",
    variantClass[variant],
    sizeClass[size],
    className,
  );
}

type PillProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export function Pill({ variant = "solid", size = "md", className, type = "button", ...rest }: PillProps) {
  return <button type={type} className={pillClass(variant, size, className)} {...rest} />;
}

type PillLinkProps = {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
};

export function PillLink({ href, variant = "solid", size = "md", className, children, ...rest }: PillLinkProps) {
  return (
    <Link href={href} className={pillClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

type IconPillProps = ButtonHTMLAttributes<HTMLButtonElement> & { size?: number };

/** Round glass button for a single icon (header actions, nav extras). */
export function IconPill({ className, size = 44, type = "button", style, ...rest }: IconPillProps) {
  return (
    <button
      type={type}
      style={{ width: size, height: size, ...style }}
      className={cn(
        "glass-strong inline-flex items-center justify-center rounded-full text-ink",
        "transition-transform duration-200 ease-out active:scale-95",
        className,
      )}
      {...rest}
    />
  );
}
