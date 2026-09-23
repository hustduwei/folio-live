import type { Metadata } from "next";
import { Bricolage_Grotesque, JetBrains_Mono, Noto_Sans_SC } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const notoSans = Noto_Sans_SC({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["500"],
});

export const metadata: Metadata = {
  title: "持仓全景图",
  description: "实时跟踪美股持仓总市值，按板块画出仓位地图。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      className={`${display.variable} ${notoSans.variable} ${jetbrains.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
