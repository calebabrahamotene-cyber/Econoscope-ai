import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EconoScope AI",
  description: "AI-powered economic and market research — real data, transparent reasoning.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="max-w-4xl mx-auto px-6 py-6">
          <a href="/" className="text-sm font-semibold text-primary">EconoScope AI</a>
          <nav className="inline-flex gap-4 ml-6 text-sm text-inkSoft">
            <a href="/history">History</a>
            <a href="/analysis/new">Import Reasoned Report</a>
          </nav>
        </div>
        <main className="max-w-4xl mx-auto px-6 pb-20">{children}</main>
        <footer className="max-w-4xl mx-auto px-6 pb-10 text-xs text-inkFaint">
          Research tool, not financial advice. Data comes from FRED, ECB SDW, exchangerate.host and CoinGecko —
          always verify against the primary source before acting on it.
        </footer>
      </body>
    </html>
  );
}
