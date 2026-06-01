import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spark — LSI Media",
  description:
    "Multi-tenant content & SEO engine: ideation → SME-grounded generation → SEO → assets → accessibility → approval → WordPress → social → analytics.",
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
