import type { Metadata, Viewport } from 'next'
import { Inter, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import Script from 'next/script'
import './globals.css'

const _inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'ThreatAlert — Real-Time Community Safety Map',
  description:
    'Anonymous community map for real-time incident awareness. Report crime, fire, disasters & civil unrest. No sign-up, no tracking, no ads.',
  keywords: [
    'incident map',
    'community safety app',
    'real-time crime map',
    'anonymous incident reporting',
    'disaster alerts',
    'civil unrest tracker',
    'local safety map',
    'fire alerts near me',
    'community watch app',
    'open source safety PWA',
    'live incident map',
    'neighborhood alerts',
  ],
  metadataBase: new URL('https://threatalert.live'),
  alternates: {
    canonical: 'https://threatalert.live',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ThreatAlert',
  },
  openGraph: {
    title: 'ThreatAlert — Real-Time Community Safety Map',
    description:
      'Anonymous community-driven incident reporting. Pin crime, fire, disasters, and unrest on a live shared map. No sign-up. No tracking. Just signal.',
    url: 'https://threatalert.live',
    siteName: 'ThreatAlert',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'ThreatAlert — live global incident map',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ThreatAlert — Real-Time Community Safety Map',
    description:
      'Anonymous incident reporting on a live shared map. No sign-up. No tracking. Community-verified.',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f5f7' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1220' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/apple-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="font-sans antialiased overflow-hidden">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        {/* Capture beforeinstallprompt as early as possible — before React hydrates.
            Android Chrome fires this event very early and it won't repeat, so we stash
            it on window and the InstallPWAButton component picks it up from there. */}
        <Script id="capture-install-prompt" strategy="beforeInteractive">{`
          window.__installPromptEvent = null;
          window.addEventListener('beforeinstallprompt', function(e) {
            e.preventDefault();
            window.__installPromptEvent = e;
            window.dispatchEvent(new Event('installpromptcaptured'));
          });
        `}</Script>

        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').then(
                  (registration) => {
                    console.log('SW registered:', registration);
                  },
                  (error) => {
                    console.log('SW registration failed:', error);
                  }
                );
              });
            }
          `}
        </Script>
      </body>
    </html>
  )
}
