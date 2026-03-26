import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { supabase } from "@/lib/supabase";
import nodemailer from "nodemailer";

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

function buildTransporter() {
  const secure =
    String(process.env.SMTP_SECURE || "false") === "true" ||
    Number(process.env.SMTP_PORT) === 465;

  const rejectUnauthorized =
    String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED || "true") !== "false";

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure,
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
    tls: { rejectUnauthorized },
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  } as any);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[MP webhook] body:", body);

    const paymentId = body?.data?.id ? String(body.data.id) : null;

    if (!paymentId) {
      return NextResponse.json({ ok: true });
    }

    const payment = await getMercadoPagoPayment(paymentId);

    const clientId =
      payment?.external_reference ||
      payment?.metadata?.clientId ||
      null;

    if (!clientId) {
      console.error("[MP webhook] pago sin external_reference", payment);
      return NextResponse.json({ ok: true });
    }

    const mpStatus = payment?.status || null;

    const { data: order, error: orderError } = await supabase
      .from("sample_orders")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();

    if (orderError) {
      console.error("[MP webhook] error buscando orden", orderError);
      return NextResponse.json({ error: "Error buscando orden" }, { status: 500 });
    }

    if (!order) {
      console.error("[MP webhook] no existe orden para clientId", clientId);
      return NextResponse.json({ ok: true });
    }

    // Siempre actualizamos ids/estado de MP
    const { error: baseUpdateError } = await supabase
      .from("sample_orders")
      .update({
        mp_payment_id: String(payment.id),
        mp_status: mpStatus,
        status: mpStatus === "approved" ? "paid_confirmed" : "pending_payment",
      })
      .eq("client_id", clientId);

    if (baseUpdateError) {
      console.error("[MP webhook] DB update error", baseUpdateError);
      return NextResponse.json({ error: "DB update error" }, { status: 500 });
    }

    // Solo mandamos mails si realmente está aprobado
    if (mpStatus !== "approved") {
      return NextResponse.json({ ok: true });
    }

    // Si ya fue procesada antes, no repetir correos
    if (order.processed_at) {
      console.log("[MP webhook] orden ya procesada, no se reenvían mails", clientId);
      return NextResponse.json({ ok: true });
    }

    const transporter = buildTransporter();
    await transporter.verify();

    const adminTo = process.env.SAMPLES_TO_EMAIL || "hola@gobio.ar";
    const from = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@gobio.ar";

    const products = Array.isArray(order.products_json) ? order.products_json : [];
    const productLines =
      products.length > 0
        ? products
            .map((p: any, i: number) => {
              const qty = p?.qty ?? p?.quantity ?? "-";
              const name = p?.name || p?.product || "Producto";
              const category = p?.category ? `${p.category} - ` : "";
              return `- Producto ${i + 1}: ${category}${name} | Cantidad: ${qty}`;
            })
            .join("\n")
        : "(sin productos)";

    const shippingText = `$ ${new Intl.NumberFormat("es-AR").format(
      Number(order.shipping_fee || 0)
    )}`;

    const adminText =
      `Pago aprobado de muestras GoBio\n\n` +
      `Referencia: ${order.client_id}\n` +
      `Payment ID: ${payment.id}\n` +
      `Estado: ${mpStatus}\n\n` +
      `Datos del cliente:\n` +
      `- Nombre y apellido: ${order.nombre_apellido || "-"}\n` +
      `- Empresa: ${order.empresa || "-"}\n` +
      `- DNI / CUIT: ${order.dni_cuit || "-"}\n` +
      `- Teléfono: ${order.telefono || "-"}\n` +
      `- Correo: ${order.email || "-"}\n\n` +
      `Dirección de entrega:\n` +
      `- Dirección: ${order.direccion || "-"}\n` +
      `- Localidad: ${order.localidad || "-"}\n` +
      `- Provincia: ${order.provincia || "-"}\n` +
      `- Código postal: ${order.codigo_postal || "-"}\n\n` +
      `Selección de muestras:\n${productLines}\n\n` +
      `Costo de envío: ${shippingText}\n\n` +
      `Comentarios: ${order.comentarios || "-"}\n`;

    const adminHtml = `
      <div style="font-family:Montserrat,Arial,sans-serif;color:#363636;line-height:1.5">
        <h2 style="margin:0 0 12px;font-weight:700;color:#32AA93">Pago aprobado de muestras GoBio</h2>
        <p style="margin:0 0 12px"><strong>Referencia:</strong> ${order.client_id}</p>
        <p style="margin:0 0 12px"><strong>Payment ID:</strong> ${payment.id}</p>
        <p style="margin:0 0 16px"><strong>Estado:</strong> ${mpStatus}</p>

        <h3 style="margin:16px 0 8px">Datos del cliente</h3>
        <ul style="margin:0 0 16px;padding-left:18px">
          <li><strong>Nombre y apellido:</strong> ${order.nombre_apellido || "-"}</li>
          <li><strong>Empresa:</strong> ${order.empresa || "-"}</li>
          <li><strong>DNI / CUIT:</strong> ${order.dni_cuit || "-"}</li>
          <li><strong>Teléfono:</strong> ${order.telefono || "-"}</li>
          <li><strong>Correo:</strong> ${order.email || "-"}</li>
        </ul>

        <h3 style="margin:16px 0 8px">Dirección</h3>
        <ul style="margin:0 0 16px;padding-left:18px">
          <li><strong>Dirección:</strong> ${order.direccion || "-"}</li>
          <li><strong>Localidad:</strong> ${order.localidad || "-"}</li>
          <li><strong>Provincia:</strong> ${order.provincia || "-"}</li>
          <li><strong>Código postal:</strong> ${order.codigo_postal || "-"}</li>
        </ul>

        <h3 style="margin:16px 0 8px">Productos</h3>
        <pre style="white-space:pre-wrap;font-family:inherit">${productLines}</pre>

        <p style="margin:16px 0 8px"><strong>Costo de envío:</strong> ${shippingText}</p>
        <p style="margin:0"><strong>Comentarios:</strong> ${order.comentarios || "-"}</p>
      </div>
    `;

    await transporter.sendMail({
      from,
      to: adminTo,
      subject: `Pago aprobado – Muestras GoBio (Ref: ${order.client_id})`,
      text: adminText,
      html: adminHtml,
      replyTo: order.email || undefined,
    });

    if (order.email) {
      const userText =
        `¡Gracias por confiar en GoBio!\n\n` +
        `Tu pago fue aprobado correctamente.\n` +
        `Referencia: ${order.client_id}\n\n` +
        `Dentro de los próximos 2 a 5 días hábiles vas a recibir tu caja de muestras en la dirección indicada.\n\n` +
        `Si tenés alguna duda, escribinos a hola@gobio.ar.`;

      const userHtml = `
        <div style="font-family:Montserrat,Arial,sans-serif;color:#363636;line-height:1.6">
          <div style="background:linear-gradient(135deg,#32AA93 0%,#7CBF81 100%);padding:18px;border-radius:14px 14px 0 0;color:white">
            <h1 style="margin:0;font-size:20px;font-weight:700">¡Gracias por confiar en GoBio!</h1>
            <p style="margin:6px 0 0;opacity:.95">Tu pago fue aprobado correctamente</p>
          </div>
          <div style="border:1px solid #E6EBF2;border-top:none;border-radius:0 0 14px 14px;padding:20px;background:#ffffff">
            <p style="margin:0 0 12px">Referencia: <strong>${order.client_id}</strong></p>
            <p style="margin:0 0 16px">
              Recibimos tu pago y ya estamos avanzando con la preparación de tu caja de muestras.
            </p>
            <p style="margin:0 0 16px">
              Dentro de los próximos <strong>2 a 5 días hábiles</strong> vas a recibirla en la dirección indicada.
            </p>
            <p style="margin:16px 0 0;color:#667387;font-size:13px">
              Si tenés alguna duda, escribinos a
              <a href="mailto:hola@gobio.ar" style="color:#32AA93;text-decoration:none"> hola@gobio.ar</a>.
            </p>
          </div>
        </div>
      `;

      await transporter.sendMail({
        from,
        to: order.email,
        subject: `Pago aprobado – Solicitud de muestras GoBio (Ref: ${order.client_id})`,
        text: userText,
        html: userHtml,
      });
    }

    const { error: processedError } = await supabase
      .from("sample_orders")
      .update({
        processed_at: new Date().toISOString(),
      })
      .eq("client_id", clientId);

    if (processedError) {
      console.error("[MP webhook] error marcando processed_at", processedError);
      return NextResponse.json({ error: "Error marcando orden procesada" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("/api/mp/webhook error", err);
    return NextResponse.json({ error: "Error inesperado" }, { status: 500 });
  }
}