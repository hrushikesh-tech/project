import type { Metadata } from "next";

import { AppProviders } from "@/providers/app-providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "Amdox ERP",
  description: "Amdox cloud ERP workspace for finance, operations, BI, and projects.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="app-body">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
