import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Antigravity | AI-Driven On-Demand Vehicle Maintenance & Roadside Dispatch",
  description: "Matched roadside vehicle assistance and mobile mechanic booking ecosystem powered by multimodal AI diagnostics and escrow payouts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-[#0A0A0C] antialiased">
      <body className="min-h-full flex flex-col font-sans text-gray-200">
        {children}
      </body>
    </html>
  );
}
