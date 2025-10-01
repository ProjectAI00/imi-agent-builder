"use client";

import "./globals.css";
import Script from "next/script";
import { ConvexProvider } from "@/lib/convex-client";
import { convex } from "@/lib/convex-client";

// Removed next/font google imports to allow offline builds

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full">
      <body className={`antialiased h-full overflow-x-hidden`}>
        {/* Load Pinterest SDK globally to ensure official embeds render reliably */}
        <Script src="https://assets.pinterest.com/js/pinit.js" strategy="afterInteractive" />
        <ConvexProvider client={convex}>
          {children}
        </ConvexProvider>
      </body>
    </html>
  );
}
