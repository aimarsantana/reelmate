import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Geist } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const bebas = Bebas_Neue({ variable: "--font-bebas", subsets: ["latin"], weight: "400" });

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

const description =
  "Descubre cómo son de verdad tus gustos de cine · Find out what your film taste is really like. We don't store your data on any server.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Reelmate — Tu ADN de cine / Your Film DNA",
  description,
  applicationName: "Reelmate",
  openGraph: {
    title: "Reelmate — Tu ADN de cine / Your Film DNA",
    description,
    siteName: "Reelmate",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Reelmate — Tu ADN de cine", description },
};

export const viewport: Viewport = { themeColor: "#0b0a0e", colorScheme: "dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${bebas.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
