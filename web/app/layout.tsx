import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { themeInitScript } from "@/lib/theme-script";
import "../styles/globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Yapster",
  description: "Practise German by talking to a tutor who remembers you.",
  applicationName: "Yapster",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Yapster" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F7F5F2",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // data-theme is set by the inline script before paint; React must not "fix" it.
    <html lang="en" className={inter.variable} data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh text-ink">{children}</body>
    </html>
  );
}
