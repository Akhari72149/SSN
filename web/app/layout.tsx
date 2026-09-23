import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegistration } from "./pwa";

export const metadata: Metadata = {
  title: "Safer Spaces Operations",
  description: "Privacy-conscious event operations coordination.",
  applicationName: "Safer Spaces",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/app-icon.svg",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Safer Spaces",
  },
};

export const viewport: Viewport = {
  themeColor: "#302f2d",
  viewportFit: "cover",
};

export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body><PwaRegistration />{children}</body></html>}
