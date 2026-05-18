import type { Metadata } from "next";
import "./globals.css";
import VisualEditsMessenger from "../visual-edits/VisualEditsMessenger";
import ErrorReporter from "@/components/ErrorReporter";
import Script from "next/script";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "GoBio Ecoenvases - Muestras",
  description: "Solicitá tus muestras",
  icons: {
    icon: "/images/favicon.png", // tu favicon en public/images
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">
        <ErrorReporter />
        <Script
          src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/scripts//route-messenger.js"
          strategy="afterInteractive"
          data-target-origin="*"
          data-message-type="ROUTE_CHANGE"
          data-include-search-params="true"
          data-only-in-iframe="true"
          data-debug="true"
          data-custom-data='{"appName": "YourApp", "version": "1.0.0", "greeting": "hi"}'
        />
        <Header />
        {children}
        <Footer />
        <VisualEditsMessenger />
        {/* Floating WhatsApp Button */}
        <a
          href="https://wa.me/5491150073269"
          aria-label="Contactar por WhatsApp"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-5 right-5 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M20.52 3.48A11.86 11.86 0 0 0 12.04 0C5.51.02.22 5.3.24 11.84c0 2.08.55 4.1 1.6 5.9L0 24l6.4-1.68a11.8 11.8 0 0 0 5.64 1.44h.01c6.53 0 11.82-5.28 11.84-11.82A11.76 11.76 0 0 0 20.52 3.48ZM12.06 21.2h-.01c-1.86 0-3.67-.5-5.25-1.45l-.38-.22-3.8 1 1.02-3.7-.25-.38a9.65 9.65 0 0 1-1.5-5.2C1.87 6.45 6.39 1.93 12.05 1.9c2.59 0 5.03 1 6.87 2.84a9.62 9.62 0 0 1 2.84 6.86c-.02 5.66-4.56 10.2-10.7 10.2Zm6.18-7.62c-.34-.17-2.02-1-2.33-1.13-.31-.12-.53-.17-.75.18-.21.34-.86 1.12-1.06 1.35-.2.23-.39.25-.73.08-.34-.17-1.45-.53-2.76-1.7a10.32 10.32 0 0 1-1.92-2.38c-.2-.34-.02-.52.15-.7.16-.16.34-.39.5-.58.17-.2.22-.34.34-.56.12-.23.06-.43-.02-.6-.08-.17-.75-1.8-1.03-2.46-.27-.66-.55-.56-.75-.57l-.64-.01c-.2 0-.52.08-.8.39-.27.34-1.05 1.02-1.05 2.48 0 1.46 1.08 2.87 1.23 3.06.15.2 2.12 3.23 5.15 4.53.72.31 1.28.5 1.72.64.72.23 1.38.2 1.9.12.58-.09 2.02-.83 2.31-1.64.29-.8.29-1.49.2-1.64-.08-.14-.31-.22-.64-.38Z" />
          </svg>
        </a>
      </body>
    </html>
  );
}
