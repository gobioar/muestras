import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getShippingFee } from "@/config/shipping";

// Create Mercado Pago preference (Checkout Pro)
// Inputs (JSON): { provincia: string; amountOverride?: number; email?: string; clientId: string; cart?: any[] }
// Business rule: amount = amountOverride OR shipping fee by province (validated server-side)
// Returns: { init_point, preference_id, amount }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { provincia, amountOverride, email, clientId, cart } = body || {};

    if (!provincia || !clientId) {
      return NextResponse.json(
        { error: "Faltan datos: provincia y clientId son obligatorios" },
        { status: 400 }
      );
    }

    const feeByProv = getShippingFee(provincia);
    if (feeByProv == null && typeof amountOverride !== "number") {
      return NextResponse.json(
        { error: "No se pudo determinar el monto del envío" },
        { status: 400 }
      );
    }

    // Business rule: prefer override if valid, else province fee
    const validatedAmount =
      typeof amountOverride === "number" && amountOverride >= 0
        ? amountOverride
        : (feeByProv || 0);

    // Env config
    const accessToken = process.env.MP_ACCESS_TOKEN;

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      "https://muestras.gobio.ar";

    const successUrl = process.env.MP_SUCCESS_URL || `${siteUrl}/gracias`;
    const failureUrl = process.env.MP_FAILURE_URL || `${siteUrl}/gracias`;
    const pendingUrl = process.env.MP_PENDING_URL || `${siteUrl}/gracias`;

    if (!accessToken) {
      return NextResponse.json(
        { error: "Configuración inválida de Mercado Pago" },
        { status: 500 }
      );
    }

    console.info("[MP] back_urls", {
      successUrl,
      failureUrl,
      pendingUrl,
    });

    // Create preference via Mercado Pago API
    const preferencePayload = {
      items: [
        {
          title: `Envío de muestras GoBio – ${provincia}`,
          quantity: 1,
          unit_price: Number(validatedAmount.toFixed(2)),
          currency_id: "ARS",
        },
      ],
      back_urls: {
        success: successUrl,
        failure: failureUrl,
        pending: pendingUrl,
      },
      auto_return: "approved",
      payer: email ? { email } : undefined,
      metadata: {
        clientId,
        provincia,
        amount: validatedAmount,
      },
    } as any;

    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preferencePayload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[MP] create preference error", errText);
      return NextResponse.json(
        { error: "No se pudo crear la preferencia de pago" },
        { status: 500 }
      );
    }

    const data = await res.json();
    const init_point = data.init_point || data.sandbox_init_point;
    const preference_id = data.id;

    // Minimal server log (no DB):
    console.info("[ORDER] iniciado", {
      ts: new Date().toISOString(),
      clientId,
      email,
      provincia,
      amount: validatedAmount,
      method: "MP",
      preference_id,
      status: "iniciado",
      cart,
    });

    return NextResponse.json({
      init_point,
      preference_id,
      amount: validatedAmount,
    });
  } catch (err: any) {
    console.error("/api/mp/create error", err);
    return NextResponse.json({ error: "Error inesperado" }, { status: 500 });
  }
}