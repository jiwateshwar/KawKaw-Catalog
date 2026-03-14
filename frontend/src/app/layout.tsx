import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { PublicNav } from "@/components/public/PublicNav";

export const metadata: Metadata = {
  title: "KawKaw Catalog",
  description: "A bird and wildlife photography catalog",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
