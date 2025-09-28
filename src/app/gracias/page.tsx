import MPReturnResult from "@/components/MPReturnResult";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function GraciasPage() {
  return (
    <div className="min-h-[60vh] mx-auto max-w-[800px] px-6 py-12">
      <h1 className="text-[28px] leading-[36px] sm:text-[36px] sm:leading-[44px] font-semibold text-[color:var(--gb-neutral-800)]">Estado del pago</h1>
      <p className="mt-2 text-sm text-muted-foreground">Estamos verificando el estado de tu pago en Mercado Pago…</p>
      <div className="mt-8">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
          <MPReturnResult />
        </Suspense>
      </div>
    </div>
  );
}