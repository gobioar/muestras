import { NextRequest, NextResponse } from "next/server";

import {
  reconcileMercadoPagoOrder,
  sendMercadoPagoFallbackAdminEmail,
} from "@/lib/mercadopago-order";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getMercadoPagoPayment(paymentId: string) {
  const accessToken = process.env.MP_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error("Falta MP_ACCESS_TOKEN");
  }

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error consultando pago MP: ${res.status} - ${text}`);
  }

  return res.json();
}

function extractPaymentId(body: any, req: NextRequest) {
  const url = new URL(req.url);

  const directCandidates = [
    body?.data?.id,
    body?.id,
    body?.["data.id"],
    url.searchParams.get("data.id"),
    url.searchParams.get("id"),
  ];

  for (const candidate of directCandidates) {
    if (candidate != null && String(candidate).trim()) {
      return String(candidate);
    }
  }

  const resourceCandidates = [
    body?.resource,
    body?.data?.resource,
    body?.data?.resource_id,
    url.searchParams.get("resource"),
  ];

  for (const resource of resourceCandidates) {
    if (typeof resource !== "string") continue;
    const match = resource.match(/\/payments\/(\d+)/);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    console.log("[MP webhook] body:", body);

    const paymentId = extractPaymentId(body, req);

    if (!paymentId) {
      console.warn("[MP webhook] notificacion sin paymentId util", {
        query: req.nextUrl.search,
        body,
      });
      return NextResponse.json({ ok: true });
    }

    const payment = await getMercadoPagoPayment(paymentId);
    const reconciled = await reconcileMercadoPagoOrder(payment);
    if (!reconciled?.ok) {
      await sendMercadoPagoFallbackAdminEmail(payment);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("/api/mp/webhook error", err);
    return NextResponse.json({ error: "Error inesperado" }, { status: 500 });
  }
}
