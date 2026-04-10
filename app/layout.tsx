import type { Metadata } from "next";
import { Inter, Roboto } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const roboto = Roboto({
  variable: "--font-roboto",
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Super Tags Cleaner",
  description: "Nettoyez les tags Dendreo cassés dans vos fichiers Word .docx",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${inter.variable} ${roboto.variable} h-full antialiased`}
    >
      <body className="min-h-full flex bg-background text-foreground">
        <Providers attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <Sidebar />
          <main className="flex-1 ml-55 min-h-screen overflow-auto">{children}</main>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
