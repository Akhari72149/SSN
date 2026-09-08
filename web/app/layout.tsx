import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={title:"Safer Spaces Operations",description:"Privacy-conscious event operations coordination."};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
