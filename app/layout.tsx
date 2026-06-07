import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/react';
import '../src/index.css';

export const metadata: Metadata = {
  title: 'Vision Games',
  description: 'Point your camera at yourself and move. On-device, nothing uploaded.',
};

export const viewport: Viewport = {
  themeColor: '#f3e8b8',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Bungee&family=Fredoka:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
