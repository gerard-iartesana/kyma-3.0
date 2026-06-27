import type { Metadata, Viewport } from "next";
import { Noto_Serif, Inter, Noto_Sans } from "next/font/google";
import "./globals.css";
import { PWAProvider } from "@/components/PWAProvider";

const notoSerif = Noto_Serif({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const notoSans = Noto_Sans({
  subsets: ["latin"],
  variable: "--font-noto",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kyma — Conecta contigo y evoluciona",
  description: "Espacio de autoconocimiento y diario personal lento.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Kyma",
  },
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#18181b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${notoSerif.variable} ${inter.variable} ${notoSans.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <PWAProvider>
          {children}
        </PWAProvider>
      </body>
    </html>
  );
}
