import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export function Label({ children, required, htmlFor }: { children: React.ReactNode; required?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-ink">
      {children}
      {required && <span className="ms-1 text-bad">*</span>}
    </label>
  );
}

export function FieldError({ children, id }: { children?: React.ReactNode; id?: string }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 text-sm font-medium text-bad">
      {children}
    </p>
  );
}

export function FieldHint({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-sm text-muted">{children}</p>;
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-12 w-full rounded-xl border bg-surface px-4 text-base text-ink placeholder:text-muted/70 transition",
          "outline-hidden focus:border-brand focus:ring-4 focus:ring-brand/15",
          invalid ? "border-bad focus:border-bad focus:ring-bad/15" : "border-line",
          className,
        )}
        {...props}
      />
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "min-h-[88px] w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink placeholder:text-muted/70",
          "outline-hidden focus:border-brand focus:ring-4 focus:ring-brand/15",
          className,
        )}
        {...props}
      />
    );
  },
);
