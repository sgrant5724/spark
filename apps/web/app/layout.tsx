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
  // Set the theme before first paint to avoid a flash. Reads the saved choice,
  // else the OS preference. Tiny inline script; runs before React hydrates.
  const noFlashTheme = `(function(){try{var t=localStorage.getItem('spark-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashTheme }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
