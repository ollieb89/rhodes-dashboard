import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { HealthBar } from "@/components/health-bar";

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
      className={`${geistSans.variable} ${geistMono.variable} dark`}
    >
      <body className="bg-zinc-950 text-zinc-100 min-h-screen flex pt-7">
        <HealthBar />
        <Sidebar />
        <main className="flex-1 min-h-screen overflow-auto p-6 ml-56">
          {children}
        </main>
      </body>
    </html>
  );
}
