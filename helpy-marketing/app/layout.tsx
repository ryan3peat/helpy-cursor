import "./globals.css";
import { ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { MetadataUpdater } from "@/components/MetadataUpdater";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: 'Helpy - Home Management App & Household Planner',
  description: 'Helpy is the home management app that simplifies daily life. A household planner app for meals, tasks, and spending. The ideal family collaboration app.',
  keywords: ['home management app', 'household planner app', 'family task manager', 'family collaboration app', 'home helper app', 'domestic helper app', 'meal planning app for families'],
  icons: {
    icon: [
      { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
    shortcut: '/icons/favicon-32.png',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-background text-foreground">
        <LanguageProvider>
          <MetadataUpdater />
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </LanguageProvider>
      </body>
    </html>
  );
}
