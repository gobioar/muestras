"use client";

import Image from "next/image";
import { ArrowLeft } from "lucide-react";

export const Header = () => {
  return (
    <div className="w-full bg-[#1f1f1f] text-white">
      <div className="mx-auto max-w-[1180px] px-6 h-16 flex items-center justify-between">
        {/* Logo a la izquierda */}
        <div className="flex items-center">
          <a href="/" className="flex items-center">
            <Image
              src="/images/logo.png" // o "/logo.png" si está directo en /public
              alt="GoBio logo"
              width={110}
              height={32}
              priority
            />
          </a>
        </div>

        {/* Navegación a la derecha */}
        <nav className="flex items-center gap-4">
          <a
            href="https://gobio.ar"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-white/90 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gb-primary)] rounded-md px-2 py-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Ir al sitio principal
          </a>
        </nav>
      </div>
    </div>
  );
};
