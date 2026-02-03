import "./globals.css";
import Script from "next/script";
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
      <head>
        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-MQ53SNR4QZ"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());

              gtag('config', 'G-MQ53SNR4QZ');
            `,
          }}
        />
      </head>
      <body className="flex min-h-screen flex-col bg-background text-foreground">
        {/* Meta Pixel - beforeInteractive ensures it's in initial HTML for Meta Pixel Helper */}
        <Script
          id="meta-pixel"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '1683194409316610');
              fbq('track', 'PageView');
            `,
          }}
        />
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            src="https://www.facebook.com/tr?id=1683194409316610&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
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
