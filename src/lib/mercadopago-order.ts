import nodemailer from "nodemailer";

import { supabaseServer } from "@/lib/supabase-server";

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

type MercadoPagoPayment = {
  id?: string | number;
  status?: string | null;
  external_reference?: string | null;
  preference_id?: string | number | null;
  transaction_amount?: number | null;
  currency_id?: string | null;
  payer?: {
    email?: string | null;
  } | null;
  metadata?: {
    clientId?: string | null;
    preference_id?: string | number | null;
  } | null;
};

type ReconcileOptions = {
  preferenceIdHint?: string | null;
  sendEmails?: boolean;
};

function uniqueStrings(values: Array<string | number | null | undefined>) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

async function getOrderByField(field: string, value: string) {
  const { data: order, error } = await supabaseServer
    .from("sample_orders")
    .select("*")
    .eq(field, value)
    .maybeSingle();

  if (error) {
    console.error("[MP reconcile] error buscando orden", { field, value, error });
    throw new Error("Error buscando orden");
  }

  return order;
}

async function findOrderForPayment(payment: MercadoPagoPayment, options?: ReconcileOptions) {
  const clientIdCandidates = uniqueStrings([
    payment?.external_reference,
    payment?.metadata?.clientId,
  ]);

  for (const clientId of clientIdCandidates) {
    const order = await getOrderByField("client_id", clientId);
    if (order) {
      return { order, clientId, matchType: "client_id" as const };
    }
  }

  const preferenceIdCandidates = uniqueStrings([
    payment?.preference_id,
    payment?.metadata?.preference_id,
    options?.preferenceIdHint,
  ]);

  for (const preferenceId of preferenceIdCandidates) {
    const order = await getOrderByField("mp_preference_id", preferenceId);
    if (order) {
      return {
        order,
        clientId: order.client_id,
        preferenceId,
        matchType: "mp_preference_id" as const,
      };
    }
  }

  const paymentIdCandidates = uniqueStrings([payment?.id]);

  for (const paymentId of paymentIdCandidates) {
    const order = await getOrderByField("mp_payment_id", paymentId);
    if (order) {
      return {
        order,
        clientId: order.client_id,
        paymentId,
        matchType: "mp_payment_id" as const,
      };
    }
  }

  return null;
}

export async function sendMercadoPagoFallbackAdminEmail(
  payment: MercadoPagoPayment,
  options?: ReconcileOptions
) {
  try {
    if (String(process.env.SAMPLES_DRY_RUN || "false") === "true") return;
    if (payment?.status !== "approved") return;

    const transporter = buildTransporter();
    await transporter.verify();

    const adminTo = process.env.SAMPLES_TO_EMAIL || "hola@gobio.ar";
    const from = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@gobio.ar";
    const preferenceId =
      options?.preferenceIdHint || payment?.preference_id || payment?.metadata?.preference_id || "-";
    const clientId = payment?.external_reference || payment?.metadata?.clientId || "-";
    const payerEmail = payment?.payer?.email || "-";
    const amount =
      payment?.transaction_amount != null
        ? `${payment.transaction_amount} ${payment.currency_id || ""}`.trim()
        : "-";

    const subject = `Pago aprobado - Mercado Pago (sin orden vinculada)`;
    const text =
      `Se aprobo un pago por Mercado Pago pero no se pudo vincular automaticamente a sample_orders.\n\n` +
      `payment_id: ${payment?.id || "-"}\n` +
      `preference_id: ${preferenceId}\n` +
      `client_id/external_reference: ${clientId}\n` +
      `monto: ${amount}\n` +
      `payer: ${payerEmail}\n` +
      `estado: ${payment?.status || "-"}\n`;

    const html = `
      <div style="font-family:Montserrat,Arial,sans-serif;color:#363636;line-height:1.5">
        <h2 style="margin:0 0 12px;font-weight:700;color:#32AA93">Pago aprobado - Mercado Pago</h2>
        <p style="margin:0 0 16px">
          No se pudo vincular automaticamente este pago con una orden en <code>sample_orders</code>.
        </p>
        <ul style="margin:0;padding-left:18px">
          <li><strong>payment_id:</strong> ${payment?.id || "-"}</li>
          <li><strong>preference_id:</strong> ${preferenceId}</li>
          <li><strong>client_id / external_reference:</strong> ${clientId}</li>
          <li><strong>monto:</strong> ${amount}</li>
          <li><strong>payer:</strong> ${payerEmail}</li>
          <li><strong>estado:</strong> ${payment?.status || "-"}</li>
        </ul>
      </div>
    `;

    await transporter.sendMail({
      from,
      to: adminTo,
      subject,
      text,
      html,
    });
  } catch (error) {
    console.warn("[MP fallback] admin email warning", (error as any)?.message || error);
  }
}

export async function reconcileMercadoPagoOrder(payment: MercadoPagoPayment, options?: ReconcileOptions) {
  const found = await findOrderForPayment(payment, options);

  if (!found) {
    console.error("[MP reconcile] no se pudo vincular orden", {
      paymentId: payment?.id || null,
      external_reference: payment?.external_reference || null,
      metadataClientId: payment?.metadata?.clientId || null,
      preference_id: payment?.preference_id || payment?.metadata?.preference_id || options?.preferenceIdHint || null,
    });
    return { ok: false, reason: "order-not-found" as const };
  }

  const { order, clientId } = found;

  const mpStatus = payment?.status || null;
  const preferenceId =
    options?.preferenceIdHint || payment?.preference_id || payment?.metadata?.preference_id || order.mp_preference_id;

  const { error: baseUpdateError } = await supabaseServer
    .from("sample_orders")
    .update({
      mp_payment_id: payment?.id ? String(payment.id) : order.mp_payment_id,
      mp_preference_id: preferenceId ? String(preferenceId) : order.mp_preference_id,
      mp_status: mpStatus,
      status: mpStatus === "approved" ? "paid_confirmed" : "pending_payment",
    })
    .eq("client_id", clientId);

  if (baseUpdateError) {
    console.error("[MP reconcile] DB update error", baseUpdateError);
    throw new Error("DB update error");
  }

  if (mpStatus !== "approved") {
    return { ok: true, approved: false, clientId };
  }

  if (options?.sendEmails === false) {
    return { ok: true, approved: true, processed: false, clientId };
  }

  if (order.processed_at) {
    console.log("[MP reconcile] orden ya procesada, no se reenvian mails", clientId);
    return { ok: true, approved: true, processed: false, alreadyProcessed: true, clientId };
  }

  const claimTimestamp = new Date().toISOString();
  const { data: claimedRows, error: claimError } = await supabaseServer
    .from("sample_orders")
    .update({
      processed_at: claimTimestamp,
    })
    .eq("client_id", clientId)
    .is("processed_at", null)
    .select("client_id");

  if (claimError) {
    console.error("[MP reconcile] error reclamando orden para emails", claimError);
    throw new Error("Error reclamando orden para emails");
  }

  if (!claimedRows?.length) {
    console.log("[MP reconcile] orden ya reclamada/procesada, no se reenvian mails", clientId);
    return { ok: true, approved: true, processed: false, alreadyProcessed: true, clientId };
  }

  const transporter = buildTransporter();
  try {
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
              const sku = p?.sku ? ` [SKU: ${p.sku}]` : "";
              return `- Producto ${i + 1}: ${category}${name}${sku} | Cantidad: ${qty}`;
            })
            .join("\n")
        : "(sin productos)";

    const productLinesHtml =
      products.length > 0
        ? products
            .map((p: any, i: number) => {
              const qty = p?.qty ?? p?.quantity ?? "-";
              const name = p?.name || p?.product || "Producto";
              const category = p?.category ? `${p.category} - ` : "";
              const skuHtml = p?.sku ? ` <span style="color:#667387;font-family:monospace;font-size:12px">[${p.sku}]</span>` : "";
              return `<li><strong>Producto ${i + 1}:</strong> ${category}${name}${skuHtml} <span style="color:#667387">- Cantidad:</span> ${qty}</li>`;
            })
            .join("")
        : "<li>(sin productos)</li>";

    const shippingText = `$ ${new Intl.NumberFormat("es-AR").format(
      Number(order.shipping_fee || 0)
    )}`;

    const adminText =
      `Pago aprobado de muestras GoBio\n\n` +
      `Referencia: ${order.client_id}\n` +
      `Payment ID: ${payment.id || "-"}\n` +
      `Estado: ${mpStatus}\n\n` +
      `Datos del cliente:\n` +
      `- Nombre y apellido: ${order.nombre_apellido || "-"}\n` +
      `- Empresa: ${order.empresa || "-"}\n` +
      `- DNI / CUIT: ${order.dni_cuit || "-"}\n` +
      `- Telefono: ${order.telefono || "-"}\n` +
      `- Correo: ${order.email || "-"}\n\n` +
      `Direccion de entrega:\n` +
      `- Direccion: ${order.direccion || "-"}\n` +
      `- Localidad: ${order.localidad || "-"}\n` +
      `- Provincia: ${order.provincia || "-"}\n` +
      `- Codigo postal: ${order.codigo_postal || "-"}\n\n` +
      `Seleccion de muestras:\n${productLines}\n\n` +
      `Costo de envio: ${shippingText}\n\n` +
      `Comentarios: ${order.comentarios || "-"}\n`;

    const adminHtml = `
      <div style="font-family:Montserrat,Arial,sans-serif;color:#363636;line-height:1.5">
        <h2 style="margin:0 0 12px;font-weight:700;color:#32AA93">Pago aprobado de muestras GoBio</h2>
        <p style="margin:0 0 12px"><strong>Referencia:</strong> ${order.client_id}</p>
        <p style="margin:0 0 12px"><strong>Payment ID:</strong> ${payment.id || "-"}</p>
        <p style="margin:0 0 16px"><strong>Estado:</strong> ${mpStatus}</p>

        <h3 style="margin:16px 0 8px">Datos del cliente</h3>
        <ul style="margin:0 0 16px;padding-left:18px">
          <li><strong>Nombre y apellido:</strong> ${order.nombre_apellido || "-"}</li>
          <li><strong>Empresa:</strong> ${order.empresa || "-"}</li>
          <li><strong>DNI / CUIT:</strong> ${order.dni_cuit || "-"}</li>
          <li><strong>Telefono:</strong> ${order.telefono || "-"}</li>
          <li><strong>Correo:</strong> ${order.email || "-"}</li>
        </ul>

        <h3 style="margin:16px 0 8px">Direccion</h3>
        <ul style="margin:0 0 16px;padding-left:18px">
          <li><strong>Direccion:</strong> ${order.direccion || "-"}</li>
          <li><strong>Localidad:</strong> ${order.localidad || "-"}</li>
          <li><strong>Provincia:</strong> ${order.provincia || "-"}</li>
          <li><strong>Codigo postal:</strong> ${order.codigo_postal || "-"}</li>
        </ul>

        <h3 style="margin:16px 0 8px">Productos</h3>
        <ul style="margin:0 0 16px;padding-left:18px">${productLinesHtml}</ul>

        <p style="margin:16px 0 8px"><strong>Costo de envio:</strong> ${shippingText}</p>
        <p style="margin:0"><strong>Comentarios:</strong> ${order.comentarios || "-"}</p>
      </div>
    `;

    await transporter.sendMail({
      from,
      to: adminTo,
      subject: `Pago aprobado - Muestras GoBio (Ref: ${order.client_id})`,
      text: adminText,
      html: adminHtml,
      replyTo: order.email || undefined,
    });

    if (order.email) {
      const userText =
        `Gracias por confiar en GoBio.\n\n` +
        `Tu pago fue aprobado correctamente.\n` +
        `Referencia: ${order.client_id}\n\n` +
        `Tus datos:\n` +
        `- Nombre y apellido: ${order.nombre_apellido || "-"}\n` +
        `- Empresa: ${order.empresa || "-"}\n` +
        `- DNI / CUIT: ${order.dni_cuit || "-"}\n` +
        `- Telefono: ${order.telefono || "-"}\n` +
        `- Correo: ${order.email || "-"}\n\n` +
        `Direccion de entrega:\n` +
        `- Direccion: ${order.direccion || "-"}\n` +
        `- Localidad: ${order.localidad || "-"}\n` +
        `- Provincia: ${order.provincia || "-"}\n` +
        `- Codigo postal: ${order.codigo_postal || "-"}\n\n` +
        `Productos solicitados:\n${productLines}\n\n` +
        `Costo de envio: ${shippingText}\n` +
        `Comentarios: ${order.comentarios || "-"}\n\n` +
        `Dentro de los proximos 2 a 5 dias habiles vas a recibir tu caja de muestras en la direccion indicada.\n\n` +
        `Si tenes alguna duda, escribinos a hola@gobio.ar.`;

      const userHtml = `
        <div style="font-family:Montserrat,Arial,sans-serif;color:#363636;line-height:1.6">
          <div style="background:linear-gradient(135deg,#32AA93 0%,#7CBF81 100%);padding:18px;border-radius:14px 14px 0 0;color:white">
            <h1 style="margin:0;font-size:20px;font-weight:700">Gracias por confiar en GoBio</h1>
            <p style="margin:6px 0 0;opacity:.95">Tu pago fue aprobado correctamente</p>
          </div>
          <div style="border:1px solid #E6EBF2;border-top:none;border-radius:0 0 14px 14px;padding:20px;background:#ffffff">
            <p style="margin:0 0 12px">Referencia: <strong>${order.client_id}</strong></p>
            <p style="margin:0 0 16px">
              Recibimos tu pago y ya estamos avanzando con la preparacion de tu caja de muestras.
            </p>

            <h3 style="margin:16px 0 8px">Tus datos</h3>
            <ul style="margin:0 0 16px;padding-left:18px">
              <li><strong>Nombre y apellido:</strong> ${order.nombre_apellido || "-"}</li>
              <li><strong>Empresa:</strong> ${order.empresa || "-"}</li>
              <li><strong>DNI / CUIT:</strong> ${order.dni_cuit || "-"}</li>
              <li><strong>Telefono:</strong> ${order.telefono || "-"}</li>
              <li><strong>Correo:</strong> ${order.email || "-"}</li>
            </ul>

            <h3 style="margin:16px 0 8px">Direccion de entrega</h3>
            <ul style="margin:0 0 16px;padding-left:18px">
              <li><strong>Direccion:</strong> ${order.direccion || "-"}</li>
              <li><strong>Localidad:</strong> ${order.localidad || "-"}</li>
              <li><strong>Provincia:</strong> ${order.provincia || "-"}</li>
              <li><strong>Codigo postal:</strong> ${order.codigo_postal || "-"}</li>
            </ul>

            <h3 style="margin:16px 0 8px">Productos solicitados</h3>
            <ul style="margin:0 0 16px;padding-left:18px">${productLinesHtml}</ul>

            <p style="margin:0 0 12px"><strong>Costo de envio:</strong> ${shippingText}</p>
            <p style="margin:0 0 16px"><strong>Comentarios:</strong> ${order.comentarios || "-"}</p>
            <p style="margin:0 0 16px">
              Dentro de los proximos <strong>2 a 5 dias habiles</strong> vas a recibirla en la direccion indicada.
            </p>
            <p style="margin:16px 0 0;color:#667387;font-size:13px">
              Si tenes alguna duda, escribinos a
              <a href="mailto:hola@gobio.ar" style="color:#32AA93;text-decoration:none"> hola@gobio.ar</a>.
            </p>
          </div>
        </div>
      `;

      await transporter.sendMail({
        from,
        to: order.email,
        subject: `Pago aprobado - Solicitud de muestras GoBio (Ref: ${order.client_id})`,
        text: userText,
        html: userHtml,
      });
    }
  } catch (sendError) {
    const { error: rollbackError } = await supabaseServer
      .from("sample_orders")
      .update({
        processed_at: null,
      })
      .eq("client_id", clientId)
      .eq("processed_at", claimTimestamp);

    if (rollbackError) {
      console.error("[MP reconcile] error revirtiendo processed_at", rollbackError);
    }

    throw sendError;
  }

  return { ok: true, approved: true, processed: true, clientId };
}
