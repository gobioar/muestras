"use client";

import Image from "next/image";

export const Footer = () => {
  return (
    <footer className="bg-[#cad2dd] text-[color:var(--gb-neutral-800)]">
      <div className="mx-auto max-w-[1180px] px-6 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          {/* Left: Brand + contacts */}
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:gap-8">
            <div className="flex items-center">
              <Image
                src="/images/logo2.png" // el archivo debe estar en /public/logo2.png
                alt="GoBio logo"
                width={120}      // ajustá el tamaño a gusto
                height={34}
                priority
              />
            </div>
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <li>
                <a href="mailto:hola@gobio.ar" className="hover:underline">
                  hola@gobio.ar
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/5491127871523"
                  className="hover:underline"
                >
                  +54 11 2787 1523
                </a>
              </li>
              <li className="text-muted-foreground">© 2021 GoBio</li>
            </ul>
          </div>

          {/* Right: Description */}
          <p className="max-w-2xl text-center text-sm leading-6 md:text-left">
            GoBio es la respuesta e invitación a revertir el impacto nocivo de
            los plásticos en el ambiente. Desarrollamos envases para alimentos
            que son 100% biodegradables.
          </p>
        </div>
      </div>
    </footer>
  );
};
