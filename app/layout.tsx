import type { Metadata } from "next";
import { Rajdhani } from "next/font/google";
import "./globals.css";

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-rajdhani",
});

export const metadata: Metadata = {
  title: "Krineo | Accountable market reasoning",
  description: "An evidence-first workspace for inspectable market reasoning.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${rajdhani.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
