"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { getShippingFee } from "@/config/shipping";
import { BANK_INFO } from "@/config/payments";

type Category = "Accesorios" | "Bandejas" | "Bowls" | "Cubiertos" | "Estuches" | "Platos" | "Vasos";

type StoredCartItem = { id: string; name: string; category: Category; qty: number };

type StoredForm = {
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

type CheckoutPayload = {
  form: StoredForm;
  cart: StoredCartItem[];
  clientId: string;
  provincia: string;
  shippingFee?: number | null;
};

function generateClientId() {
  const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `GB-${Date.now().toString().slice(-6)}-${rnd}`;
}

export const ResumenPago = () => {
  const router = useRouter();
  const [payload, setPayload] = useState<CheckoutPayload | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"mp" | "transfer" | "">("");
  const [mpLoading, setMpLoading] = useState(false);
  const [mpError, setMpError] = useState<string | null>(null);
  const [transferReceipt, setTransferReceipt] = useState<{ name: string; base64: string } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("gobio.checkout");
      if (!raw) return;
      const parsed = JSON.parse(raw) as CheckoutPayload;
      setPayload(parsed);
      setPaymentMethod("mp");
    } catch {
      // noop
    }
  }, []);

  const totalUnits = useMemo(() => {
    return payload ? payload.cart.reduce((s, it) => s + (it.qty || 0), 0) : 0;
  }, [payload]);

  const shippingFee = useMemo(() => {
    if (!payload) return null;
    const fee = getShippingFee(payload.form.provincia);
    return fee ?? payload.shippingFee ?? null;
  }, [payload]);

  const startMpCheckout = async () => {
  setMpError(null);
  setServerError(null);

  if (!payload) return;
  if (!payload.form.provincia) {
    setServerError("Seleccione una provincia.");
    return;
  }
  if (shippingFee == null) {
    setServerError("No se pudo calcular el costo de envío.");
    return;
  }
  if (totalUnits <= 0) {
    setServerError("Seleccione al menos un producto.");
    return;
  }

  try {
    setMpLoading(true);

    const clientId = payload.clientId || generateClientId();

    const saveRes = await fetch("/api/checkout/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clientId,
        form: payload.form,
        cart: payload.cart,
        shippingFee,
      }),
    });

    if (!saveRes.ok) {
      const data = await saveRes.json().catch(() => ({}));
      throw new Error(data?.error || "No se pudo guardar la solicitud");
    }

    const res = await fetch("/api/mp/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provincia: payload.form.provincia,
        amountOverride: shippingFee ?? undefined,
        email: payload.form.email || undefined,
        clientId,
        cart: payload.cart,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || "No se pudo iniciar el pago");
    }

    const data = await res.json();
    const url: string | undefined = data?.init_point;

    if (url) {
      window.location.href = url;
    } else {
      throw new Error("Respuesta inválida del servidor");
    }
  } catch (e: any) {
    setMpError(e?.message || "Error inesperado al crear el pago");
  } finally {
    setMpLoading(false);
  }
};

  const handleReceiptChange = async (file?: File | null) => {
    if (!file) {
      setTransferReceipt(null);
      return;
    }

    const toBase64 = (f: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });

    const b64 = await toBase64(file);
    setTransferReceipt({ name: file.name, base64: b64 });
  };

  const submitTransfer = async () => {
    setServerError(null);

    if (!payload) return;
    if (!paymentMethod) {
      setServerError("Seleccione un método de pago.");
      return;
    }
    if (totalUnits <= 0) {
      setServerError("Seleccione al menos un producto.");
      return;
    }

    try {
      setSubmitting(true);

      const products = payload.cart.map((it) => ({
        product: `${it.category} - ${it.name}`,
        quantity: String(it.qty),
      }));

      const res = await fetch("/api/samples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload.form,
          comentarios: payload.form.comentarios,
          shippingFee,
          paymentMethod: "transfer",
          transferReceipt,
          products,
          clientId: payload.clientId,
          consent: true,
          notifyUser: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.details || data?.error || "Error al enviar la solicitud.");
      }

      try {
        localStorage.removeItem("gobio.checkout");
      } catch {}

      router.push("/gracias?status=submitted");
    } catch (e: any) {
      setServerError(e?.message || "Ocurrió un error inesperado.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!payload) {
    return (
      <Card className="max-w-[900px] mx-auto shadow-sm rounded-2xl border border-[color:var(--gb-border-soft)]">
        <CardHeader>
          <CardTitle className="text-[22px] leading-[28px]">Resumen y pago</CardTitle>
          <CardDescription>
            No encontramos un checkout activo. Volvé al formulario para completar tus datos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => router.push("/")}
            className="bg-[linear-gradient(135deg,#32AA93_0%,#7CBF81_100%)] text-white"
          >
            Ir al formulario
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-[1180px] mx-auto shadow-sm rounded-2xl border border-[color:var(--gb-border-soft)]">
      <CardHeader className="pb-4">
        <CardTitle className="text-[28px] leading-[36px] sm:text-[36px] sm:leading-[44px] font-semibold text-[color:var(--gb-neutral-800)]">
          Resumen y pago
        </CardTitle>
        <CardDescription className="text-base leading-6 text-[color:var(--gb-neutral-600)]">
          Revisá tus datos y elegí el método de pago para el envío.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-8">
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-[color:var(--gb-border-soft)] bg-white p-4">
            <p className="text-sm font-semibold text-[color:var(--gb-neutral-800)]">Resumen</p>

            <ul className="mt-2 space-y-1 text-sm text-[color:var(--gb-neutral-600)]">
              <li>Cliente: {payload.form.nombreApellido || "-"}</li>
              <li>Empresa: {payload.form.empresa || "-"}</li>
              <li>Documento: {payload.form.dniCuit || "-"}</li>
              <li>
                Contacto: {payload.form.email || "-"} · {payload.form.telefono || "-"}
              </li>
              <li>Dirección: {payload.form.direccion || "-"}</li>
              <li>Localidad: {payload.form.localidad || "-"}</li>
              <li>CP: {payload.form.codigoPostal || "-"}</li>
              <li>Provincia: {payload.form.provincia || "-"}</li>
              <li>Unidades en carrito: {totalUnits}</li>
            </ul>

            <div className="mt-3 pt-3 border-t flex items-center justify-between">
              <span className="text-sm">Envío</span>
              <span className="text-sm font-semibold">
                {payload.form.provincia && shippingFee !== null
                  ? `$ ${new Intl.NumberFormat("es-AR").format(shippingFee || 0)}`
                  : "—"}
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm">Total a pagar</span>
              <span className="text-[15px] font-semibold">
                {payload.form.provincia && shippingFee !== null
                  ? `$ ${new Intl.NumberFormat("es-AR").format(shippingFee || 0)}`
                  : "—"}
              </span>
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              El costo del envío se reintegra al 100% en su primer pedido.
            </p>

            <div className="mt-4">
              <Button variant="secondary" onClick={() => router.push("/")}>
                Editar datos
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-[color:var(--gb-border-soft)] bg-white p-4">
            <p className="text-sm font-semibold text-[color:var(--gb-neutral-800)]">
              Método de pago
            </p>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                type="button"
                variant={paymentMethod === "mp" ? undefined : "secondary"}
                className={`justify-center ${
                  paymentMethod === "mp"
                    ? "text-white bg-[linear-gradient(135deg,#32AA93_0%,#7CBF81_100%)] hover:brightness-[1.05]"
                    : ""
                }`}
                onClick={() => setPaymentMethod("mp")}
              >
                Pagar con Mercado Pago
              </Button>

              <Button
                type="button"
                variant={paymentMethod === "transfer" ? undefined : "secondary"}
                className={`justify-center ${
                  paymentMethod === "transfer"
                    ? "text-white bg-[linear-gradient(135deg,#32AA93_0%,#7CBF81_100%)] hover:brightness-[1.05]"
                    : ""
                }`}
                onClick={() => setPaymentMethod("transfer")}
              >
                Transferencia bancaria
              </Button>
            </div>

            {paymentMethod === "mp" && (
              <div className="mt-4 space-y-2">
                <Button
                  type="button"
                  onClick={startMpCheckout}
                  disabled={mpLoading}
                  className="h-11 rounded-xl px-5 text-white bg-[linear-gradient(135deg,#32AA93_0%,#7CBF81_100%)] hover:brightness-[1.05] disabled:opacity-50"
                >
                  {mpLoading ? "Iniciando pago…" : "Pagar con Mercado Pago"}
                </Button>

                {mpError && <p className="text-sm text-destructive">{mpError}</p>}
              </div>
            )}

            {paymentMethod === "transfer" && (
              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-[color:var(--gb-border-soft)] p-3 bg-[rgba(50,170,147,.06)]">
                  <p className="text-sm font-medium text-[color:var(--gb-neutral-800)]">
                    Datos bancarios
                  </p>

                  <ul className="mt-1 text-sm text-[color:var(--gb-neutral-800)]">
                    <li>Banco: {BANK_INFO.banco}</li>
                    <li>Nro Cuenta: {BANK_INFO.nroCuenta}</li>
                    <li>Alias: {BANK_INFO.alias}</li>
                    <li>CBU/CVU: {BANK_INFO.cbu}</li>
                    <li>Titular: {BANK_INFO.titular}</li>
                    <li>CUIT: {BANK_INFO.cuit}</li>
                  </ul>
                </div>

                <p className="text-sm text-[color:var(--gb-neutral-600)]">
                  Adjunte el comprobante o envíelo a{" "}
                  <a className="underline" href="mailto:hola@gobio.ar">
                    hola@gobio.ar
                  </a>{" "}
                  o WhatsApp:{" "}
                  <a
                    className="underline"
                    href="https://wa.me/5491150073269"
                    target="_blank"
                    rel="noreferrer"
                  >
                    wa.me/5491150073269
                  </a>
                  <a
                    href="https://wa.me/5491150073269"
                    aria-label="Abrir WhatsApp"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366] text-white align-middle shadow-sm hover:brightness-110"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M20.52 3.48A11.86 11.86 0 0 0 12.04 0C5.51.02.22 5.3.24 11.84c0 2.08.55 4.1 1.6 5.9L0 24l6.4-1.68a11.8 11.8 0 0 0 5.64 1.44h.01c6.53 0 11.82-5.28 11.84-11.82A11.76 11.76 0 0 0 20.52 3.48ZM12.06 21.2h-.01c-1.86 0-3.67-.5-5.25-1.45l-.38-.22-3.8 1 1.02-3.7-.25-.38a9.65 9.65 0 0 1-1.5-5.2C1.87 6.45 6.39 1.93 12.05 1.9c2.59 0 5.03 1 6.87 2.84a9.62 9.62 0 0 1 2.84 6.86c-.02 5.66-4.56 10.2-10.7 10.2Zm6.18-7.62c-.34-.17-2.02-1-2.33-1.13-.31-.12-.53-.17-.75.18-.21.34-.86 1.12-1.06 1.35-.2.23-.39.25-.73.08-.34-.17-1.45-.53-2.76-1.7a10.32 10.32 0 0 1-1.92-2.38c-.2-.34-.02-.52.15-.7.16-.16.34-.39.5-.58.17-.2.22-.34.34-.56.12-.23.06-.43-.02-.6-.08-.17-.75-1.8-1.03-2.46-.27-.66-.55-.56-.75-.57l-.64-.01c-.2 0-.52.08-.8.39-.27.34-1.05 1.02-1.05 2.48 0 1.46 1.08 2.87 1.23 3.06.15.2 2.12 3.23 5.15 4.53.72.31 1.28.5 1.72.64.72.23 1.38.2 1.9.12.58-.09 2.02-.83 2.31-1.64.29-.8.29-1.49.2-1.64-.08-.14-.31-.22-.64-.38Z" />
                    </svg>
                  </a>
                </p>

                <div className="space-y-2">
                  <Label htmlFor="receipt">Comprobante (opcional)</Label>
                  <Input
                    id="receipt"
                    type="file"
                    accept="image/*,application/pdf"
                    className="h-11"
                    onChange={(e) => handleReceiptChange(e.target.files?.[0] || null)}
                  />
                  {transferReceipt && (
                    <p className="text-xs text-muted-foreground">
                      Adjunto: {transferReceipt.name}
                    </p>
                  )}
                </div>

                <div className="pt-1">
                  <Button
                    type="button"
                    onClick={submitTransfer}
                    disabled={submitting}
                    className="h-11 rounded-xl px-5 text-white bg-[linear-gradient(135deg,#32AA93_0%,#7CBF81_100%)] hover:brightness-[1.05] disabled:opacity-50"
                  >
                    {submitting ? "Enviando…" : "Enviar solicitud"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>

        {serverError && (
          <div className="text-sm text-destructive" role="alert">
            {serverError}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
