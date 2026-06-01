import type { Metadata } from "next";
import { Inter, Noto_Sans_TC } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import IdleTimerListener from "@/components/providers/IdleTimerListener";
import { Toaster } from "@/components/ui/toaster";
import { Agentation } from "agentation";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GlobalErrorHandler } from "@/components/GlobalErrorHandler";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const notoSansTC = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-noto-sans-tc",
});

export const metadata: Metadata = {
  title: "工務室電子白板",
  description: "佳里奇美醫院工務室電子白板管理系統",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <body className={`${inter.variable} ${notoSansTC.variable} font-sans antialiased`}>
        <ErrorBoundary source="RootLayout">
          <ThemeProvider>
            <AuthProvider>
              {children}
              <IdleTimerListener />
              <Toaster />
              <Agentation />
              <GlobalErrorHandler />
            </AuthProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}

