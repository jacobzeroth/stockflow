import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StockFlow — Inventory control",
  description:
    "Professional inventory management for small teams: stock ledger, reorder alerts, suppliers and reporting.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink text-silver">{children}</body>
    </html>
  );
}
