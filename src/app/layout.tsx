import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0F172A",
};

export const metadata: Metadata = {
  title: "Warung Prapatan - Pencatatan Stok Terpadu & AI Chatbot",
  description: "Sistem Manajemen Stok Warung Prapatan Berbasis Web Terintegrasi AI Chatbot Telegram",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/logo-icon.png?v=2", type: "image/png" }
    ],
    shortcut: "/favicon.ico",
    apple: "/logo-icon.png?v=2"
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
