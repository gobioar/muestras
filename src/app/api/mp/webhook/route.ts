import { createHmac, timingSafeEqual } from "crypto";
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

// Valida el header x-signature de Mercado Pago. Solo se aplica si MP_WEBHOOK_SECRET
// está configurado (Tus integraciones > Webhooks > clave secreta).
function hasValidSignature(req: NextRequest) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true;

  const signature = req.headers.get("x-signature") || "";
  const requestId = req.headers.get("x-request-id");
  const parts = Object.fromEntries(
    signature.split(",").map((part) => {
      const [key, ...rest] = part.split("=");
      return [key?.trim(), rest.join("=").trim()];
    })
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  let dataId = req.nextUrl.searchParams.get("data.id");
  if (dataId && /^[a-z0-9]+$/i.test(dataId)) dataId = dataId.toLowerCase();

  let manifest = "";
  if (dataId) manifest += `id:${dataId};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;

  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  try {
    if (!hasValidSignature(req)) {
      console.warn("[MP webhook] firma invalida", { query: req.nextUrl.search });
      return NextResponse.json({ error: "Firma invalida" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    console.log("[MP webhook] notificacion", {
      type: body?.type || body?.topic || null,
      action: body?.action || null,
      dataId: body?.data?.id || null,
    });

    const paymentId = extractPaymentId(body, req);

    if (!paymentId) {
      console.warn("[MP webhook] notificacion sin paymentId util", {
        query: req.nextUrl.search,
        type: body?.type || body?.topic || null,
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
