import type { Metadata } from "next";
import "./globals.css";
import { FormGuard } from "@/components/form-guard";

export const metadata: Metadata = {
  title: "StockFlow — Inventory control",
  description:
    "Professional inventory management for small teams: stock ledger, reorder alerts, suppliers and reporting.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink text-silver">
        <FormGuard />
        {children}
      </body>
    </html>
  );
}
