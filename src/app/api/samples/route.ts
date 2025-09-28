import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import nodemailer from "nodemailer";
import { getShippingFee } from "@/config/shipping";

function generateServerId() {
  const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `GB-${Date.now().toString().slice(-6)}-${rnd}`;
}

function isEmailValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      nombreApellido,
      telefono,
      email,
      direccion,
      localidad,
      codigoPostal,
      provincia,
      products = [],
      comentarios,
      whatsappPreferred,
      whatsappTime,
      consent,
      clientId,
      // Nuevos campos para flujo de envío/pago
      shippingFee: clientShippingFee,
      paymentMethod,
      mpPreferenceId,
      mpPaymentId,
      mpStatus,
      transferReceipt,
      notifyUser,
    } = body || {};

    const id = typeof clientId === "string" && clientId ? clientId : generateServerId();

    // Basic server-side validation to mirror client rules
    const errors: Record<string, string> = {};
    if (!nombreApellido?.trim()) errors.nombreApellido = "Campo obligatorio.";
    if (!telefono?.trim()) errors.telefono = "Campo obligatorio.";
    if (!email?.trim()) errors.email = "Campo obligatorio.";
    else if (!isEmailValid(email)) errors.email = "El correo no tiene un formato válido.";
    if (!direccion?.trim()) errors.direccion = "Campo obligatorio.";
    if (!localidad?.trim()) errors.localidad = "Campo obligatorio.";
    if (!codigoPostal?.trim()) errors.codigoPostal = "Campo obligatorio.";
    if (!provincia?.trim()) errors.provincia = "Campo obligatorio.";

    if (!products?.[0]?.product) errors.product0 = "Seleccione un producto.";
    const qty0 = products?.[0]?.quantity;
    if (!qty0) errors.quantity0 = "Ingrese una cantidad numérica.";
    else if (isNaN(Number(qty0))) errors.quantity0 = "Ingrese una cantidad numérica.";

    [1, 2].forEach((idx) => {
      const p = products?.[idx];
      if (!p) return;
      const anyFilled = p.product || p.quantity;
      if (anyFilled) {
        if (!p.product) errors[`product${idx}`] = "Seleccione un producto.";
        if (!p.quantity) errors[`quantity${idx}`] = "Ingrese una cantidad numérica.";
        else if (isNaN(Number(p.quantity))) errors[`quantity${idx}`] = "Ingrese una cantidad numérica.";
      }
    });

    if (!consent) errors.consent = "Debe aceptar el consentimiento.";

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ error: "Revise los campos obligatorios.", errors }, { status: 400 });
    }

    // Cálculo seguro del costo de envío en el servidor
    const serverShippingFee = getShippingFee(provincia) ?? null;
    const shippingFeeToUse = typeof clientShippingFee === "number" && clientShippingFee >= 0 ? clientShippingFee : (serverShippingFee ?? 0);

    // Asunto incluye provincia (requisito)
    const subject = `Solicitud de muestras – ${nombreApellido} – ${provincia || localidad || ""}`.trim();

    const adminTo = process.env.SAMPLES_TO_EMAIL || "hola@gobio.ar";
    const from = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@gobio.ar";

    // Allow dry-run mode to succeed without sending emails (useful in local/dev environments)
    if (String(process.env.SAMPLES_DRY_RUN || "false") === "true") {
      console.info("[samples] DRY RUN enabled - skipping SMTP send", { id, to: adminTo, from });
      return NextResponse.json({ ok: true, id, dryRun: true });
    }

    const secure = String(process.env.SMTP_SECURE || "false") === "true" || Number(process.env.SMTP_PORT) === 465;
    const rejectUnauthorized = String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED || "true") !== "false";

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
      // Timeouts to avoid hanging
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    } as any);

    // Verify SMTP configuration/connection first
    try {
      await transporter.verify();
    } catch (verifyErr: any) {
      console.error("/api/samples SMTP verify error", verifyErr);
      const message = verifyErr?.message || "SMTP verification failed";
      const payload: any = { error: "Error al enviar la solicitud." };
      if (process.env.NODE_ENV !== "production") payload.details = message;
      return NextResponse.json(payload, { status: 500 });
    }

    const productLines = (products || [])
      .filter((p: any) => p && (p.product || p.quantity))
      .map((p: any, i: number) => `- Producto ${i + 1}: ${p.product || "(sin seleccionar)"} | Cantidad: ${p.quantity || "-"}`)
      .join("\n");

    const paymentLines = (() => {
      if (paymentMethod === "mp") {
        return (
          `Método de pago: Mercado Pago\n` +
          `- preference_id: ${mpPreferenceId || "-"}\n` +
          `- payment_id: ${mpPaymentId || "-"}\n` +
          `- estado: ${mpStatus || "-"}`
        );
      }
      if (paymentMethod === "transfer") {
        return `Método de pago: Transferencia bancaria${transferReceipt?.name ? ` (adjuntó: ${transferReceipt.name})` : ""}`;
      }
      return `Método de pago: (no seleccionado)`;
    })();

    const adminText = `Nueva solicitud de muestras (ID: ${id})\n\n` +
      `Datos de contacto:\n` +
      `- Nombre y apellido: ${nombreApellido}\n` +
      `- Teléfono: ${telefono}\n` +
      `- Correo: ${email}\n\n` +
      `Dirección de entrega:\n` +
      `- Dirección: ${direccion}\n` +
      `- Localidad: ${localidad}\n` +
      `- Provincia: ${provincia}\n` +
      `- Código postal: ${codigoPostal}\n\n` +
      `Selección de muestras:\n${productLines || "(sin productos)"}\n\n` +
      `Costo de envío aplicado: $ ${new Intl.NumberFormat("es-AR").format(shippingFeeToUse)}\n` +
      `${paymentLines}\n\n` +
      `Comentarios: ${comentarios || "-"}\n\n` +
      `Preferencias de contacto:\n` +
      `- WhatsApp: ${whatsappPreferred ? "Sí" : "No"}\n` +
      `- Franja horaria: ${whatsappTime || "-"}\n\n` +
      `Consentimiento: ${consent ? "Aceptado" : "No"}\n`;

    const userAutoText = `Recibimos su solicitud de muestras. N.º de referencia: ${id}. Contacto: hola@gobio.ar.`;

    // NEW: HTML versions (admin + user)
    const productLinesHtml = (products || [])
      .filter((p: any) => p && (p.product || p.quantity))
      .map((p: any, i: number) => `<li><strong>Producto ${i + 1}:</strong> ${p.product || "(sin seleccionar)"} <span style="color:#667387">• Cantidad:</span> ${p.quantity || "-"}</li>`) 
      .join("");

    const adminHtml = `
      <div style="font-family:Montserrat,Arial,sans-serif; color:#363636; line-height:1.5">
        <h2 style="margin:0 0 12px; font-weight:700; color:#32AA93">Nueva solicitud de muestras</h2>
        <p style="margin:0 0 16px">ID: <strong>${id}</strong></p>

        <h3 style="margin:16px 0 8px; color:#363636">Datos de contacto</h3>
        <ul style="margin:0 0 16px; padding-left:18px">
          <li><strong>Nombre y apellido:</strong> ${nombreApellido}</li>
          <li><strong>Teléfono:</strong> ${telefono}</li>
          <li><strong>Correo:</strong> ${email}</li>
        </ul>

        <h3 style="margin:16px 0 8px; color:#363636">Dirección de entrega</h3>
        <ul style="margin:0 0 16px; padding-left:18px">
          <li><strong>Dirección:</strong> ${direccion}</li>
          <li><strong>Localidad:</strong> ${localidad}</li>
          <li><strong>Provincia:</strong> ${provincia}</li>
          <li><strong>Código postal:</strong> ${codigoPostal}</li>
        </ul>

        <h3 style="margin:16px 0 8px; color:#363636">Selección de muestras</h3>
        <ul style="margin:0 0 16px; padding-left:18px">${productLinesHtml || "<li>(sin productos)</li>"}</ul>

        <p style="margin:0 0 8px"><strong>Costo de envío aplicado:</strong> $ ${new Intl.NumberFormat("es-AR").format(shippingFeeToUse)}</p>
        <p style="white-space:pre-wrap; margin:0 0 16px">${paymentLines}</p>

        <p style="margin:0 0 16px"><strong>Comentarios:</strong> ${comentarios || "-"}</p>

        <h3 style="margin:16px 0 8px; color:#363636">Preferencias de contacto</h3>
        <ul style="margin:0 0 16px; padding-left:18px">
          <li><strong>WhatsApp:</strong> ${whatsappPreferred ? "Sí" : "No"}</li>
          <li><strong>Franja horaria:</strong> ${whatsappTime || "-"}</li>
        </ul>

        <p style="margin:24px 0 0; font-size:12px; color:#667387">Consentimiento: ${consent ? "Aceptado" : "No"}</p>
      </div>
    `;

    const userHtml = `
      <div style="font-family:Montserrat,Arial,sans-serif; color:#363636; line-height:1.6">
        <div style="background:linear-gradient(135deg,#32AA93 0%,#7CBF81 100%); padding:18px; border-radius:14px 14px 0 0; color:white">
          <h1 style="margin:0; font-size:20px; font-weight:700">¡Gracias por confiar en GoBio!</h1>
          <p style="margin:6px 0 0; opacity:0.95">Recibimos tu solicitud de muestras</p>
        </div>
        <div style="border:1px solid #E6EBF2; border-top:none; border-radius:0 0 14px 14px; padding:20px; background:#ffffff">
          <p style="margin:0 0 12px">Referencia: <strong>${id}</strong></p>
          <p style="margin:0 0 16px">En breve un asesor se comunicará para coordinar la entrega. Mientras tanto, te compartimos el resumen de tu solicitud:</p>

          <h3 style="margin:0 0 8px; color:#363636">Tus datos</h3>
          <ul style="margin:0 0 16px; padding-left:18px; color:#363636">
            <li><strong>Nombre y apellido:</strong> ${nombreApellido}</li>
            <li><strong>Teléfono:</strong> ${telefono}</li>
            <li><strong>Correo:</strong> ${email}</li>
          </ul>
          <h3 style="margin:0 0 8px; color:#363636">Dirección de entrega</h3>
          <ul style="margin:0 0 16px; padding-left:18px; color:#363636">
            <li><strong>Dirección:</strong> ${direccion}</li>
            <li><strong>Localidad:</strong> ${localidad}</li>
            <li><strong>Provincia:</strong> ${provincia}</li>
            <li><strong>Código postal:</strong> ${codigoPostal}</li>
          </ul>
          <h3 style="margin:0 0 8px; color:#363636">Productos solicitados</h3>
          <ul style="margin:0 0 16px; padding-left:18px; color:#363636">${productLinesHtml || "<li>(sin productos)</li>"}</ul>
          <p style="margin:0 0 16px"><strong>Costo de envío estimado:</strong> $ ${new Intl.NumberFormat("es-AR").format(shippingFeeToUse)}</p>
          ${comentarios ? `<p style="margin:0 0 16px"><strong>Comentarios:</strong> ${comentarios}</p>` : ""}

          <div style="margin:20px 0; padding:14px; background:#FAFAFA; border:1px solid #E6EBF2; border-radius:12px; color:#363636">
            <p style="margin:0 0 6px"><strong>Próximos pasos</strong></p>
            <ol style="margin:0; padding-left:18px">
              <li>Un asesor de GoBio confirmará tu solicitud y la fecha de entrega.</li>
              <li>Recibirás novedades por correo o WhatsApp según tu preferencia.</li>
              <li>Probá las muestras en tu operación. Te acompañamos en el proceso.</li>
            </ol>
          </div>

          <p style="margin:16px 0 0; color:#667387; font-size:13px">¿Dudas o cambios? Escribinos a <a href="mailto:hola@gobio.ar" style="color:#32AA93; text-decoration:none">hola@gobio.ar</a>. Estamos para ayudarte.</p>
        </div>
      </div>
    `;

    // NUEVO: si es transferencia, enviar un aviso breve al admin sin repetir datos
    const adminSubject = paymentMethod === "transfer" ? `Pago recibido – Transferencia bancaria (Ref: ${id})` : subject;
    const adminTextFinal = paymentMethod === "transfer"
      ? `Se recibió un pago por transferencia bancaria para la solicitud de muestras.\n\nReferencia: ${id}\n${transferReceipt?.name ? `Comprobante adjunto: ${transferReceipt.name}` : "Sin comprobante adjunto"}`
      : adminText;
    const adminHtmlFinal = paymentMethod === "transfer"
      ? `
        <div style="font-family:Montserrat,Arial,sans-serif;color:#363636;line-height:1.5">
          <h2 style="margin:0 0 12px;font-weight:700;color:#32AA93">Pago recibido – Transferencia bancaria</h2>
          <p style="margin:0 0 12px">Referencia: <strong>${id}</strong></p>
          <p style="margin:0 0 4px">${transferReceipt?.name ? `Comprobante adjunto: <strong>${transferReceipt.name}</strong>` : "Sin comprobante adjunto"}</p>
        </div>
      `
      : adminHtml;

    // Adjuntos (solo si hay comprobante en base64)
    const attachments: any[] | undefined = transferReceipt?.base64
      ? [
          {
            filename: transferReceipt.name || "comprobante",
            content: transferReceipt.base64,
            encoding: "base64",
          },
        ]
      : undefined;

    // Send admin email
    try {
      await transporter.sendMail({
        from,
        to: adminTo,
        subject: adminSubject,
        text: adminTextFinal,
        html: adminHtmlFinal,
        replyTo: email,
        attachments,
      });
    } catch (sendErr: any) {
      console.error("/api/samples admin send error", sendErr);
      const message = sendErr?.message || "Admin email send failed";
      const payload: any = { error: "Error al enviar la solicitud." };
      if (process.env.NODE_ENV !== "production") payload.details = message;
      return NextResponse.json(payload, { status: 500 });
    }

    // Send copy/auto-response to requester (best-effort)
    try {
      if (notifyUser !== false) {
        await transporter.sendMail({
          from,
          to: email,
          subject: `¡Gracias por confiar en GoBio! Solicitud de muestras (Ref: ${id})`,
          text: `${userAutoText}\n\nCopia de su solicitud:\n\n${adminText}`,
          html: userHtml,
        });
      }
    } catch (copyErr: any) {
      console.warn("/api/samples user copy send warning", copyErr?.message || copyErr);
      // Do not fail the whole request if copy fails
    }

    return NextResponse.json({ ok: true, id, shippingFee: shippingFeeToUse });
  } catch (err: any) {
    console.error("/api/samples error", err);
    const payload: any = { error: "Error al enviar la solicitud." };
    if (process.env.NODE_ENV !== "production") payload.details = err?.message;
    return NextResponse.json(payload, { status: 500 });
  }
}