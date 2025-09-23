import "./globals.css";
import Script from "next/script";

// Removed next/font google imports to allow offline builds

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`antialiased h-full overflow-x-hidden`}>
        {/* Load Pinterest SDK globally to ensure official embeds render reliably */}
        <Script src="https://assets.pinterest.com/js/pinit.js" strategy="afterInteractive" />
        {children}
      </body>
    </html>
  );
}
