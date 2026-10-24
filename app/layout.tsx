import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider as LiveStoreProvider } from "@/lib/store";
import { DemoStoreProvider } from "@/lib/demo-store";

/** وضع العرض التجريبي للمراجعة المحلية فقط */
const StoreProvider = process.env.NEXT_PUBLIC_DEMO === "1" ? DemoStoreProvider : LiveStoreProvider;
import { ToastProvider } from "@/components/ui/toast";
import { PwaInstall } from "@/components/pwa/install";

export const metadata: Metadata = {
  title: "استقبال المستفيدين — أرض الإنسان",
  description: "نظام استقبال وتوجيه المستفيدين",
  applicationName: "استقبال AEI",
  appleWebApp: { capable: true, title: "استقبال AEI", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-dvh font-sans" suppressHydrationWarning>
        <StoreProvider>
          <ToastProvider>
            {children}
            <PwaInstall />
          </ToastProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
