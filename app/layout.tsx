import type { Metadata } from "next";
import { Rubik, Fredoka, Nunito } from "next/font/google";
import { getT } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";
import "./globals.css";

// Rubik carries the Hebrew glyphs — Fredoka/Nunito are Latin-only, so the
// browser falls back to Rubik per-character for `he` text automatically.
const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin", "hebrew"],
});

const fredoka = Fredoka({
  variable: "--font-fredoka",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-body",
  weight: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Group Polls",
  description: "Dynamic polls for your friend group.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale, dir } = await getT();

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${rubik.variable} ${fredoka.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-ink">
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
