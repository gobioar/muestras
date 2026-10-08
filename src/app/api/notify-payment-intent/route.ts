import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import nodemailer from "nodemailer";
import { escapeHtml } from "@/lib/escape-html";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId, form, cart, shippingFee } = body ?? {};

    if (!form || !Array.isArray(cart)) {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
    }

    const adminTo = process.env.SAMPLES_TO_EMAIL || "hola@gobio.ar";
    const from = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@gobio.ar";

    const secure =
      String(process.env.SMTP_SECURE || "false") === "true" ||
      Number(process.env.SMTP_PORT) === 465;

    const rejectUnauthorized =
      String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED || "true") !== "false";

    const transporter = nodemailer.createTransport({
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

    try {
      await transporter.verify();
    } catch (verifyErr: any) {
      console.error("/api/notify-payment-intent SMTP verify error", verifyErr);
      const payload: any = { error: "No se pudo verificar el envío del mail." };
      if (process.env.NODE_ENV !== "production") {
        payload.details = verifyErr?.message || "SMTP verification failed";
      }
      return NextResponse.json(payload, { status: 500 });
    }

    const productsText =
      cart.length > 0
        ? cart
            .map(
              (it: any) =>
                `- ${it?.category || "Sin categoría"} / ${it?.name || "Sin nombre"} x ${it?.qty || 0}`
            )
            .join("\n")
        : "Sin productos";

    const shippingText =
      typeof shippingFee === "number"
        ? `$ ${new Intl.NumberFormat("es-AR").format(shippingFee)}`
        : shippingFee != null
          ? `$ ${shippingFee}`
          : "No informado";

    const text = `Nuevo intento de pago con Mercado Pago

ClientId: ${clientId || "No informado"}

Nombre: ${form?.nombreApellido || "-"}
Email: ${form?.email || "-"}
Teléfono: ${form?.telefono || "-"}
Empresa: ${form?.empresa || "-"}
DNI/CUIT: ${form?.dniCuit || "-"}

Dirección: ${form?.direccion || "-"}
Localidad: ${form?.localidad || "-"}
Provincia: ${form?.provincia || "-"}
CP: ${form?.codigoPostal || "-"}

Productos:
${productsText}

Costo envío: ${shippingText}

Comentarios: ${form?.comentarios || "-"}

Fecha: ${new Date().toLocaleString("es-AR")}
`;

    const html = `
      <div style="font-family:Montserrat,Arial,sans-serif;color:#363636;line-height:1.5">
        <h2 style="margin:0 0 12px;font-weight:700;color:#32AA93">
          Nuevo intento de pago con Mercado Pago
        </h2>

        <p style="margin:0 0 16px">ClientId: <strong>${escapeHtml(clientId) || "No informado"}</strong></p>

        <h3 style="margin:16px 0 8px;color:#363636">Datos del cliente</h3>
        <ul style="margin:0 0 16px;padding-left:18px">
          <li><strong>Nombre:</strong> ${escapeHtml(form?.nombreApellido) || "-"}</li>
          <li><strong>Email:</strong> ${escapeHtml(form?.email) || "-"}</li>
          <li><strong>Teléfono:</strong> ${escapeHtml(form?.telefono) || "-"}</li>
          <li><strong>Empresa:</strong> ${escapeHtml(form?.empresa) || "-"}</li>
          <li><strong>DNI/CUIT:</strong> ${escapeHtml(form?.dniCuit) || "-"}</li>
        </ul>

        <h3 style="margin:16px 0 8px;color:#363636">Dirección</h3>
        <ul style="margin:0 0 16px;padding-left:18px">
          <li><strong>Dirección:</strong> ${escapeHtml(form?.direccion) || "-"}</li>
          <li><strong>Localidad:</strong> ${escapeHtml(form?.localidad) || "-"}</li>
          <li><strong>Provincia:</strong> ${escapeHtml(form?.provincia) || "-"}</li>
          <li><strong>CP:</strong> ${escapeHtml(form?.codigoPostal) || "-"}</li>
        </ul>

        <h3 style="margin:16px 0 8px;color:#363636">Productos</h3>
        <pre style="white-space:pre-wrap;margin:0 0 16px;font-family:inherit">${escapeHtml(productsText)}</pre>

        <p style="margin:0 0 8px"><strong>Costo de envío:</strong> ${escapeHtml(shippingText)}</p>
        <p style="margin:0 0 8px"><strong>Comentarios:</strong> ${escapeHtml(form?.comentarios) || "-"}</p>
        <p style="margin:16px 0 0;color:#667387;font-size:12px">Fecha: ${new Date().toLocaleString("es-AR")}</p>
      </div>
    `;

    await transporter.sendMail({
      from,
      to: adminTo,
      subject: "🟡 Intento de pago Mercado Pago - GoBio",
      text,
      html,
      replyTo: form?.email || undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("/api/notify-payment-intent error", error);
    const payload: any = { error: "Error enviando mail" };
    if (process.env.NODE_ENV !== "production") {
      payload.details = error?.message;
    }
    return NextResponse.json(payload, { status: 500 });
  }
}