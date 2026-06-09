import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "F-GUARD Node Flow | SaaS Workflow Automation Platform",
  description: "Create, schedule, and orchestrate complex DAG workflows with visually rich node canvasses, anti-SSRF HTTP connectors, sandboxed JS script execution, and robust live execution tracking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${outfit.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
