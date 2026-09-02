import type { Metadata } from "next";
import { Rubik, Geist_Mono } from "next/font/google";
import { getT } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-geist-sans",
  subsets: ["latin", "hebrew"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
      className={`${rubik.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
