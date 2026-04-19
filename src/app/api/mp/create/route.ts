import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getShippingFee } from "@/config/shipping";
import { supabaseServer } from "@/lib/supabase-server";

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

    const validatedAmount =
      typeof amountOverride === "number" && amountOverride >= 0
        ? amountOverride
        : feeByProv || 0;

    const accessToken = process.env.MP_ACCESS_TOKEN;

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      "https://muestras.gobio.ar";

    const successUrl = process.env.MP_SUCCESS_URL || `${siteUrl}/gracias`;
    const failureUrl = process.env.MP_FAILURE_URL || `${siteUrl}/gracias`;
    const pendingUrl = process.env.MP_PENDING_URL || `${siteUrl}/gracias`;
    const notificationUrl = `${siteUrl}/api/mp/webhook`;

    if (!accessToken) {
      return NextResponse.json(
        { error: "Configuración inválida de Mercado Pago" },
        { status: 500 }
      );
    }

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
      external_reference: clientId,
      notification_url: notificationUrl,
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

    const { error: updateError } = await supabaseServer
      .from("sample_orders")
      .update({
        mp_preference_id: preference_id,
      })
      .eq("client_id", clientId);

    if (updateError) {
      console.error("DB update error", updateError);
      return NextResponse.json(
        { error: "No se pudo actualizar la solicitud" },
        { status: 500 }
      );
    }

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
