import type { Metadata } from "next";
import "./globals.css";
import "./commercial.css";
import "./research.css";

export const metadata: Metadata = {
  title: "Global-Trade-El-Nino-Map — Trade & Climate Atlas",
  description: "Explore global trade corridors on a satellite globe, compare NOAA climate and water-level records, and follow the official ENSO outlook.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
