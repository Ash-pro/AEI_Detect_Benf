import { BrandMark } from "./brand-mark";

export function AuthLayout({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-6xl items-center px-4 py-5">
        <BrandMark />
      </div>
      <div className="flex flex-1 items-start justify-center px-4 pb-10 pt-4 sm:items-center sm:pt-0">
        <div className="w-full max-w-xl animate-fade-up">{children}</div>
      </div>
      {footer && <div className="px-4 pb-6 text-center text-xs text-muted">{footer}</div>}
    </main>
  );
}
