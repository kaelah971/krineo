import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Krineo | Accountable market reasoning",
  description: "An evidence-first workspace for inspectable market reasoning.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
