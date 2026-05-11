import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ConveGenius Team Blog",
    template: "%s · ConveGenius Team Blog",
  },
  description: "Internal weekly updates from the ConveGenius.ai team.",
  robots: { index: false, follow: false, nocache: true },
  icons: {
    icon: "https://i.ibb.co/gMxYNcBX/image-4.png",
    shortcut: "https://i.ibb.co/gMxYNcBX/image-4.png",
    apple: "https://i.ibb.co/gMxYNcBX/image-4.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
