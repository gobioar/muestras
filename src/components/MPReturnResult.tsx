"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function MPReturnResult() {
  const sp = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState<{
    ok?: boolean;
    status?: string;
    status_detail?: string;
    payment_id?: string;
    preference_id?: string;
    transaction_amount?: number;
  } | null>(null);
  const [mailSent, setMailSent] = useState(false);

  const params = useMemo(() => {
    return {
      status: sp.get("status") || sp.get("collection_status") || "",
      payment_id: sp.get("payment_id") || sp.get("collection_id") || "",
      preference_id: sp.get("preference_id") || "",
    };
  }, [sp]);

  useEffect(() => {
    const verify = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!params.payment_id && !params.preference_id) {
          setVerified({ ok: false, status: params.status || "unknown" });
          setLoading(false);
          return;
        }
        const url = new URL("/api/mp/verify", window.location.origin);
        if (params.payment_id) url.searchParams.set("payment_id", params.payment_id);
        if (params.preference_id) url.searchParams.set("preference_id", params.preference_id);
        url.searchParams.set("notify", "true");
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "Error al verificar el pago");
        }
        const data = await res.json();
        setVerified(data);
        // Si el pago está aprobado y solicitamos notify=true, marcamos dedupe para evitar doble envío por /api/samples
        try {
          const status = (data?.status || params.status || "").toLowerCase();
          if (status === "approved") {
            const raw = localStorage.getItem("gobio.checkout");
            if (raw) {
              const checkout = JSON.parse(raw);
              const clientId: string | undefined = checkout?.clientId;
              if (clientId) {
                const dedupeKey = `mpMail:${clientId}`;
                sessionStorage.setItem(dedupeKey, "1");
                setMailSent(true);
              }
            }
          }
        } catch {}
      } catch (e: any) {
        setError(e.message || "Error inesperado");
      } finally {
        setLoading(false);
      }
    };
    verify();
  }, [params.payment_id, params.preference_id, params.status]);

  // Enviar mail a admin cuando el pago MP esté aprobado (una sola vez)
  useEffect(() => {
    const status = (verified?.status || params.status || "").toLowerCase();
    if (status !== "approved") return;

    try {
      const raw = localStorage.getItem("gobio.checkout");
      if (!raw) return;
      const checkout = JSON.parse(raw);
      const clientId: string = checkout?.clientId;
      if (!clientId) return;

      const dedupeKey = `mpMail:${clientId}`;
      if (mailSent || sessionStorage.getItem(dedupeKey) === "1") return;

      const form = checkout?.form || {};
      const cart = Array.isArray(checkout?.cart) ? checkout.cart : [];
      const products = cart.map((it: any) => ({ product: it.name, quantity: String(it.qty) }));

      (async () => {
        try {
          const res = await fetch("/api/samples", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nombreApellido: form.nombreApellido,
              telefono: form.telefono,
              email: form.email,
              direccion: form.direccion,
              localidad: form.localidad,
              codigoPostal: form.codigoPostal,
              provincia: form.provincia,
              products,
              comentarios: form.comentarios,
              whatsappPreferred: false,
              whatsappTime: "",
              consent: true,
              clientId,
              shippingFee: checkout?.shippingFee ?? null,
              paymentMethod: "mp",
              mpPreferenceId: verified?.preference_id || params.preference_id || undefined,
              mpPaymentId: verified?.payment_id || params.payment_id || undefined,
              mpStatus: "approved",
              notifyUser: false,
            }),
          });
          // Independientemente del resultado, marcamos para evitar duplicados
          setMailSent(true);
          sessionStorage.setItem(dedupeKey, "1");
          try { localStorage.removeItem("gobio.checkout"); } catch {}
        } catch {
          // no-op
        }
      })();
    } catch {
      // no-op
    }
  }, [verified?.status, verified?.payment_id, verified?.preference_id, params.status, params.payment_id, params.preference_id, mailSent]);

  const StatusBadge = ({ status }: { status?: string }) => {
    const norm = (status || "").toLowerCase();
    const color =
      norm === "approved"
        ? "bg-emerald-100 text-emerald-700"
        : norm === "pending"
        ? "bg-amber-100 text-amber-700"
        : norm === "in_process"
        ? "bg-sky-100 text-sky-700"
        : "bg-rose-100 text-rose-700";
    const label = norm || "desconocido";
    return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>{label}</span>;
  };

  return (
    <div className="rounded-2xl border border-[color:var(--gb-border-soft)] bg-white p-6">
      {loading && <p className="text-sm text-muted-foreground">Verificando pago…</p>}
      {!loading && error && (
        <div>
          <p className="text-sm text-destructive">{error}</p>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => router.push("/")}>Volver al inicio</Button>
            <Button variant="secondary" onClick={() => router.refresh()}>Reintentar</Button>
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-[color:var(--gb-neutral-800)]">Resultado</h2>
            <StatusBadge status={verified?.status || params.status} />
          </div>
          <ul className="text-sm text-[color:var(--gb-neutral-800)] space-y-1">
            <li>payment_id: <strong>{verified?.payment_id || params.payment_id || "-"}</strong></li>
            <li>preference_id: <strong>{verified?.preference_id || params.preference_id || "-"}</strong></li>
            <li>monto: <strong>{typeof verified?.transaction_amount === "number" ? `$ ${new Intl.NumberFormat("es-AR").format(verified.transaction_amount)}` : "-"}</strong></li>
            {verified?.status_detail && <li>detalle: <span className="text-muted-foreground">{verified.status_detail}</span></li>}
          </ul>

          {(verified?.status || params.status)?.toLowerCase() === "approved" ? (
            <div className="rounded-lg border border-[color:var(--gb-border-soft)] bg-[rgba(50,170,147,.08)] p-4">
              <p className="text-sm text-[color:var(--gb-neutral-800)]">
                ¡Gracias! Su pago fue aprobado. Enviaremos la confirmación por correo y prepararemos el despacho (2 a 5 días hábiles).
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-[color:var(--gb-border-soft)] bg-[#FAFAFA] p-4">
              <p className="text-sm text-[color:var(--gb-neutral-800)]">
                Si el pago quedó pendiente o falló, puede reintentarlo.
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={() => router.push("/")}>Volver al inicio</Button>
            <Button variant="secondary" onClick={() => router.back()}>Volver al formulario</Button>
          </div>
        </div>
      )}
    </div>
  );
}