import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spark — LSI Media",
  description:
    "Multi-tenant content & SEO engine: ideation → SME-grounded generation → SEO → assets → accessibility → approval → WordPress → social → analytics.",
  appleWebApp: { capable: true, title: "Spark", statusBarStyle: "black-translucent" },
};

// Mobile: responsive viewport + brand theme color for the browser/OS chrome.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0A3A56",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
