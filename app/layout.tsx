import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterSw from "./RegisterSw";

export const metadata: Metadata = {
  title: "MLH Quiz",
  description: "MLH 裝修工程大腦 — 室內裝修工程管理刷題 PWA",
};

export const viewport: Viewport = {
  themeColor: "#111111",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#111111" />
      </head>
      <body className="antialiased min-h-screen bg-white text-[#111] font-sans">
        <RegisterSw />
        {children}
      </body>
    </html>
  );
}
