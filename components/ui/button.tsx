import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "ok";
type Size = "sm" | "md" | "lg" | "xl";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-brand-ink hover:bg-brand/90 shadow-sm",
  secondary: "bg-surface text-ink border border-line hover:bg-sunken",
  ghost: "text-ink hover:bg-sunken",
  danger: "bg-bad text-white hover:bg-bad/90",
  ok: "bg-ok text-white hover:bg-ok/90 shadow-sm",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-lg gap-1.5",
  md: "h-11 px-4 text-[15px] rounded-xl gap-2",
  lg: "h-14 px-6 text-base rounded-xl gap-2",
  xl: "h-16 px-8 text-lg rounded-2xl gap-3",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", block, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "focus-ring inline-flex select-none items-center justify-center font-semibold transition-colors disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        sizes[size],
        block && "w-full",
        className,
      )}
      {...props}
    />
  );
});
