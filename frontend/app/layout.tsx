import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { HealthBar } from "@/components/health-bar";
import { ThemeProvider } from "@/components/theme-provider";
import { CommandPalette } from "@/components/command-palette";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rhodes Command Center",
  description: "Local dashboard for ollieb89",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen flex pt-7">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <HealthBar />
          <CommandPalette />
          <Sidebar />
          <main className="flex-1 min-h-screen overflow-auto p-4 md:p-6 md:ml-56 pt-16 md:pt-7">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
