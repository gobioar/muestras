import { NextRequest, NextResponse } from "next/server";

import {
  reconcileMercadoPagoOrder,
  sendMercadoPagoFallbackAdminEmail,
} from "@/lib/mercadopago-order";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const payment_id = searchParams.get("payment_id");
    const preference_id = searchParams.get("preference_id");
    const notify = searchParams.get("notify");

    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json({ error: "Configuracion de MP faltante" }, { status: 500 });
    }

    if (!payment_id && !preference_id) {
      return NextResponse.json({ error: "Falta payment_id o preference_id" }, { status: 400 });
    }

    if (payment_id) {
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("[MP] verify payment error", errText);
        return NextResponse.json({ error: "No se pudo verificar el pago" }, { status: 500 });
      }

      const data = await res.json();

      if (notify === "true") {
        try {
          const reconciled = await reconcileMercadoPagoOrder(data, {
            preferenceIdHint: preference_id,
          });
          if (!reconciled?.ok) {
            await sendMercadoPagoFallbackAdminEmail(data, {
              preferenceIdHint: preference_id,
            });
          }
        } catch (reconcileError) {
          console.error("/api/mp/verify reconcile error", reconcileError);
          await sendMercadoPagoFallbackAdminEmail(data, {
            preferenceIdHint: preference_id,
          });
        }
      }

      return NextResponse.json({
        ok: true,
        payment_id: data.id,
        status: data.status,
        status_detail: data.status_detail,
        transaction_amount: data.transaction_amount,
        currency_id: data.currency_id,
        payer: { email: data.payer?.email },
        order: data.order,
        preference_id: data.metadata?.preference_id || data.preference_id,
      });
    }

    const searchRes = await fetch(
      `https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&external_reference=&range=date_created&begin_date=${encodeURIComponent(
        new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
      )}&end_date=${encodeURIComponent(new Date().toISOString())}&offset=0&limit=10`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      }
    );

    if (!searchRes.ok) {
      const errText = await searchRes.text();
      console.error("[MP] search error", errText);
      return NextResponse.json({ error: "No se pudo verificar el pago" }, { status: 500 });
    }

    const search = await searchRes.json();
    const result = (search?.results || []).find((p: any) => p.preference_id === preference_id);

    if (!result) {
      return NextResponse.json({ ok: false, message: "No se encontraron pagos para la preferencia" });
    }

    if (notify === "true") {
      try {
        const reconciled = await reconcileMercadoPagoOrder(result, {
          preferenceIdHint: preference_id,
        });
        if (!reconciled?.ok) {
          await sendMercadoPagoFallbackAdminEmail(result, {
            preferenceIdHint: preference_id,
          });
        }
      } catch (reconcileError) {
        console.error("/api/mp/verify reconcile error", reconcileError);
        await sendMercadoPagoFallbackAdminEmail(result, {
          preferenceIdHint: preference_id,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      payment_id: result.id,
      status: result.status,
      status_detail: result.status_detail,
      transaction_amount: result.transaction_amount,
      currency_id: result.currency_id,
      payer: { email: result.payer?.email },
      preference_id: result.preference_id,
    });
  } catch (err: any) {
    console.error("/api/mp/verify error", err);
    return NextResponse.json({ error: "Error inesperado" }, { status: 500 });
  }
}
