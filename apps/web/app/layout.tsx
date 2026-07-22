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
  // Apply the saved theme + font size before first paint to avoid a flash.
  // Falls back to the OS colour preference and the default font. Tiny inline
  // script; runs before React hydrates. Keep the theme/font id lists in sync
  // with globals.css and AppearancePicker.
  const noFlashTheme = `(function(){try{var d=document.documentElement;var themes=['light','dark','midnight','slate','sepia','contrast'];var t=localStorage.getItem('spark-theme');if(themes.indexOf(t)<0){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}d.setAttribute('data-theme',t);var fonts=['sm','base','lg','xl'];var f=localStorage.getItem('spark-font');if(fonts.indexOf(f)<0){f='base';}d.setAttribute('data-font',f);}catch(e){}})();`;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashTheme }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
