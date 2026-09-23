import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
export const metadata: Metadata = {
  title: "Xiang 想 — A little character play",
  description:
    "Take Chinese characters apart, put them together, and discover a world inside every character. Explore freely or play a timed tile challenge.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <footer className="privacy-footer">
          <Link href="/privacy">Privacy</Link>
        </footer>
      </body>
    </html>
  );
}
