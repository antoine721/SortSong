import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mes applications",
  description: "Portail",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

/** Applique le thème avant le premier affichage (mode discret par défaut). */
const THEME_SCRIPT = `try{var t=localStorage.getItem("ss_theme");if(t!=="dark"){document.documentElement.classList.add("discreet");}else{document.title="SortSong"}}catch(e){document.documentElement.classList.add("discreet")}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans text-[1.0769rem]">{children}</body>
    </html>
  );
}
