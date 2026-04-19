"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type VerifiedPayment = {
  ok?: boolean;
  status?: string;
  status_detail?: string;
  payment_id?: string;
  preference_id?: string;
  transaction_amount?: number;
};

type CheckoutPayload = {
  clientId?: string;
  shippingFee?: number | null;
  form: {
    nombreApellido: string;
    telefono: string;
    email: string;
    direccion: string;
    localidad: string;
    codigoPostal: string;
    provincia: string;
    empresa: string;
    dniCuit: string;
    comentarios: string;
  };
  cart: Array<{
    id: string;
    name: string;
    category: string;
    qty: number;
  }>;
};

export default function MPReturnResult() {
  const sp = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState<VerifiedPayment | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  const params = useMemo(() => {
    return {
      status: sp.get("status") || sp.get("collection_status") || "",
      payment_id: sp.get("payment_id") || sp.get("collection_id") || "",
      preference_id: sp.get("preference_id") || "",
    };
  }, [sp]);

  const isTransferFlow =
    !params.payment_id &&
    !params.preference_id &&
    (params.status || "").toLowerCase() === "submitted";

  useEffect(() => {
    const verify = async () => {
      setLoading(true);
      setError(null);

      try {
        if (!params.payment_id && !params.preference_id) {
          setVerified({ ok: false, status: params.status || "unknown" });
          return;
        }

        const url = new URL("/api/mp/verify", window.location.origin);
        if (params.payment_id) url.searchParams.set("payment_id", params.payment_id);
        if (params.preference_id) url.searchParams.set("preference_id", params.preference_id);

        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "Error al verificar el pago");
        }

        const data = await res.json();
        setVerified(data);
      } catch (verifyError: any) {
        setError(verifyError?.message || "Error inesperado");
      } finally {
        setLoading(false);
      }
    };

    void verify();
  }, [params.payment_id, params.preference_id, params.status]);

  useEffect(() => {
    const finalizeApprovedOrder = async () => {
      const approvedStatus = (verified?.status || params.status || "").toLowerCase();
      if (approvedStatus !== "approved") return;

      const finalizationKey =
        verified?.payment_id || params.payment_id || verified?.preference_id || params.preference_id;
      if (!finalizationKey) return;

      const storageKey = `gobio.mp.finalized.${finalizationKey}`;

      try {
        if (localStorage.getItem(storageKey) === "true") {
          setFinalized(true);
          return;
        }
      } catch {}

      try {
        setFinalizing(true);
        setFinalizeError(null);

        const raw = localStorage.getItem("gobio.checkout");
        if (!raw) {
          throw new Error("No encontramos los datos del pedido para enviar la confirmacion.");
        }

        const payload = JSON.parse(raw) as CheckoutPayload;
        const products = (payload.cart || []).map((item) => ({
          product: `${item.category} - ${item.name}`,
          quantity: String(item.qty),
        }));

        const res = await fetch("/api/samples", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload.form,
            comentarios: payload.form.comentarios,
            shippingFee: payload.shippingFee ?? undefined,
            paymentMethod: "mp",
            mpPreferenceId: verified?.preference_id || params.preference_id || undefined,
            mpPaymentId: verified?.payment_id || params.payment_id || undefined,
            mpStatus: verified?.status || params.status || "approved",
            products,
            clientId: payload.clientId,
            consent: true,
            notifyUser: true,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.details || data?.error || "No se pudo enviar la confirmacion del pedido.");
        }

        try {
          localStorage.setItem(storageKey, "true");
          localStorage.removeItem("gobio.checkout");
        } catch {}

        setFinalized(true);
      } catch (finalizeErr: any) {
        setFinalizeError(
          finalizeErr?.message || "No se pudo completar la confirmacion del pedido."
        );
      } finally {
        setFinalizing(false);
      }
    };

    void finalizeApprovedOrder();
  }, [
    params.payment_id,
    params.preference_id,
    params.status,
    verified?.payment_id,
    verified?.preference_id,
    verified?.status,
  ]);

  const StatusBadge = ({ status }: { status?: string }) => {
    const norm = (status || "").toLowerCase();
    const color =
      norm === "approved"
        ? "bg-emerald-100 text-emerald-700"
        : norm === "pending"
          ? "bg-amber-100 text-amber-700"
          : norm === "in_process"
            ? "bg-sky-100 text-sky-700"
            : norm === "submitted"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-rose-100 text-rose-700";

    const label = norm === "submitted" ? "solicitud recibida" : norm || "desconocido";

    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>
        {label}
      </span>
    );
  };

  const isApproved = (verified?.status || params.status || "").toLowerCase() === "approved";

  return (
    <div className="rounded-2xl border border-[color:var(--gb-border-soft)] bg-white p-6">
      {loading && (
        <p className="text-sm text-muted-foreground">
          {isTransferFlow ? "Procesando solicitud..." : "Verificando pago..."}
        </p>
      )}

      {!loading && error && (
        <div>
          <p className="text-sm text-destructive">{error}</p>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => router.push("/")}>Volver al inicio</Button>
            <Button variant="secondary" onClick={() => router.refresh()}>
              Reintentar
            </Button>
          </div>
        </div>
      )}

      {!loading && !error && isTransferFlow && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-[color:var(--gb-neutral-800)]">
              Solicitud recibida
            </h2>
            <StatusBadge status="submitted" />
          </div>

          <div className="rounded-lg border border-[color:var(--gb-border-soft)] bg-[rgba(50,170,147,.08)] p-4">
            <p className="text-sm text-[color:var(--gb-neutral-800)]">
              Si la transferencia fue realizada correctamente, no tenes que hacer nada mas.
              Dentro de los proximos <strong>2 a 5 dias habiles</strong> vas a recibir tu
              caja de muestras.
            </p>
          </div>

          <div className="rounded-lg border border-[color:var(--gb-border-soft)] bg-[#FAFAFA] p-4">
            <p className="text-sm text-[color:var(--gb-neutral-800)]">
              Si la transferencia no fue realizada correctamente o hubo algun inconveniente con el pago,
              la solicitud de muestras sera desestimada. En ese caso, no nos comunicaremos para continuar el proceso.
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => router.push("/")}>Volver al inicio</Button>
            <Button variant="secondary" onClick={() => router.back()}>
              Volver al formulario
            </Button>
          </div>
        </div>
      )}

      {!loading && !error && !isTransferFlow && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-[color:var(--gb-neutral-800)]">
              Resultado
            </h2>
            <StatusBadge status={verified?.status || params.status} />
          </div>

          <ul className="space-y-1 text-sm text-[color:var(--gb-neutral-800)]">
            <li>
              payment_id: <strong>{verified?.payment_id || params.payment_id || "-"}</strong>
            </li>
            <li>
              preference_id: <strong>{verified?.preference_id || params.preference_id || "-"}</strong>
            </li>
            <li>
              monto:{" "}
              <strong>
                {typeof verified?.transaction_amount === "number"
                  ? `$ ${new Intl.NumberFormat("es-AR").format(verified.transaction_amount)}`
                  : "-"}
              </strong>
            </li>
            {verified?.status_detail && (
              <li>
                detalle: <span className="text-muted-foreground">{verified.status_detail}</span>
              </li>
            )}
          </ul>

          {isApproved ? (
            <div className="rounded-lg border border-[color:var(--gb-border-soft)] bg-[rgba(50,170,147,.08)] p-4">
              <p className="text-sm text-[color:var(--gb-neutral-800)]">
                Gracias. Tu pago fue aprobado. Prepararemos el despacho (2 a 5 dias habiles).
              </p>
              {finalizing && (
                <p className="mt-3 text-sm text-[color:var(--gb-neutral-800)]">
                  Estamos enviando la confirmacion y el resumen del pedido por mail...
                </p>
              )}
              {finalized && !finalizing && !finalizeError && (
                <p className="mt-3 text-sm text-[color:var(--gb-neutral-800)]">
                  La confirmacion del pedido fue enviada al cliente y a hola@gobio.ar.
                </p>
              )}
              {finalizeError && (
                <p className="mt-3 text-sm text-destructive">{finalizeError}</p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-[color:var(--gb-border-soft)] bg-[#FAFAFA] p-4">
              <p className="text-sm text-[color:var(--gb-neutral-800)]">
                Si el pago quedo pendiente o fallo, puede reintentarlo.
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={() => router.push("/")}>Volver al inicio</Button>
            <Button variant="secondary" onClick={() => router.back()}>
              Volver al formulario
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
