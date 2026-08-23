import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import AuthGate from "@/components/AuthGate";
import Nav from "@/components/Nav";

const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-cormorant" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Boulevard Victor Hugo — Studio",
  description: "Poèmes, vidéos, calendrier de publication",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${cormorant.variable} ${inter.variable}`}>
      <body style={{ fontFamily: "var(--font-inter), sans-serif" }}>
        <AuthGate>
          <Nav />
          {/* Élargi le 23/08 : le kanban a six colonnes, 1024 px les écrasait. */}
          <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
        </AuthGate>
      </body>
    </html>
  );
}
