import type { Metadata } from "next";
import { Space_Mono, Orbitron } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

// UI font — monospace, used everywhere except the hero wordmark.
const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-ui",
  display: "swap",
});

// Hero font — futuristic display, used for wordmarks and large headings.
const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["500", "700", "800", "900"],
  variable: "--font-hero",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "CG Signal — Team Blog Portal",
    template: "%s · CG Signal",
  },
  description: "Internal weekly transmissions from the ConveGenius.ai team.",
  robots: { index: false, follow: false, nocache: true },
  icons: {
    icon: "/cg.png",
    shortcut: "/cg.png",
    apple: "/cg.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceMono.variable} ${orbitron.variable}`}>
      <body className="min-h-screen bg-portal-main text-portal-text antialiased">
        {children}
        <Toaster
          theme="dark"
          richColors
          position="top-right"
          toastOptions={{
            style: {
              background: "var(--bg-panel-raised)",
              border: "1px solid var(--border-muted)",
              color: "var(--text-main)",
              fontFamily: "var(--font-ui), monospace",
            },
          }}
        />
      </body>
    </html>
  );
}
