import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import { THEME_BY_TIME } from "@/lib/theme";
import { I18nProvider } from "@/i18n/client";
import { HTML_LANG, LOCALES, dirOf, isLocale, localePath } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";

const geistSans = Geist({
  variable: "--font-geist-sans",
  // Preload only the common subset; other Unicode subsets load as needed.
  subsets: ["latin"],
  display: "optional",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "optional",
  preload: false,
});

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

// Icons and the link preview image come from the files in src/app
// (icon.svg, apple-icon.png, opengraph-image.png, twitter-image.png).
export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getMessages(locale);
  const description = t.meta.description;
  return {
    metadataBase: new URL("https://gooidy.com"),
    title: "Gooidy",
    description,
    openGraph: {
      title: "Gooidy",
      description,
      siteName: "Gooidy",
      url: localePath(locale, "/"),
      locale: HTML_LANG[locale] ?? locale,
      type: "website",
    },
    twitter: { card: "summary_large_image", title: "Gooidy", description },
  };
}

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const messages = await getMessages(locale);
  return (
    <html
      lang={HTML_LANG[locale] ?? locale}
      dir={dirOf(locale)}
      // The theme script sets data-theme before hydrating.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BY_TIME }} />
      </head>
      <body className="min-h-full flex flex-col">
        <I18nProvider locale={locale} messages={messages}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
