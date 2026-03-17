import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

async function getSiteSettings(): Promise<{ app_title: string; app_description: string | null }> {
  try {
    const base = process.env.INTERNAL_API_URL ?? "http://api:8000";
    const res = await fetch(`${base}/api/settings`, { next: { revalidate: 300 } });
    if (res.ok) return res.json();
  } catch { /* fall through */ }
  return { app_title: "KawKaw Catalog", app_description: null };
}

export async function generateMetadata(): Promise<Metadata> {
  const { app_title, app_description } = await getSiteSettings();
  return {
    title: { default: app_title, template: `%s | ${app_title}` },
    description: app_description ?? "A bird and wildlife photography catalog",
    icons: { icon: "/icon.png" },
  };
}

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
