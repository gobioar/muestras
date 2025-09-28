import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import nodemailer from "nodemailer";

// Verify Mercado Pago payment status using payment_id or preference_id
// Inputs (query or JSON): { payment_id?: string; preference_id?: string }
// Returns minimal status info for UI
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const payment_id = searchParams.get("payment_id");
    const preference_id = searchParams.get("preference_id");
    const notify = searchParams.get("notify");

    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json({ error: "Configuración de MP faltante" }, { status: 500 });
    }

    if (!payment_id && !preference_id) {
      return NextResponse.json({ error: "Falta payment_id o preference_id" }, { status: 400 });
    }

    async function sendAdminEmailOnApproved(opts: {
      status?: string;
      payment_id?: string | number;
      preference_id?: string | number;
      amount?: number;
      currency_id?: string;
      payer_email?: string | null;
    }) {
      try {
        if (String(process.env.SAMPLES_DRY_RUN || "false") === "true") return; // no-op in dry-run
        if (opts.status !== "approved") return; // solo si está aprobado

        const from = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@gobio.ar";
        const to = process.env.SAMPLES_TO_EMAIL || "hola@gobio.ar";

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
          connectionTimeout: 15_000,
          greetingTimeout: 10_000,
          socketTimeout: 20_000,
        } as any);

        try {
          await transporter.verify();
        } catch (e) {
          console.error("/api/mp/verify SMTP verify error", e);
          return; // no bloquear la verificación por fallo SMTP
        }

        const subject = `Pago aprobado – Mercado Pago (Ref: ${opts.preference_id || "-"})`;
        const text =
          `Pago aprobado via Mercado Pago\n\n` +
          `payment_id: ${opts.payment_id || "-"}\n` +
          `preference_id: ${opts.preference_id || "-"}\n` +
          `monto: ${opts.amount != null ? `${opts.amount} ${opts.currency_id || ""}` : "-"}\n` +
          `payer: ${opts.payer_email || "-"}`;

        const html = `
          <div style="font-family:Montserrat,Arial,sans-serif;color:#363636;line-height:1.5">
            <h2 style="margin:0 0 12px;font-weight:700;color:#32AA93">Pago aprobado – Mercado Pago</h2>
            <ul style="margin:0 0 16px;padding-left:18px">
              <li><strong>payment_id:</strong> ${opts.payment_id || "-"}</li>
              <li><strong>preference_id:</strong> ${opts.preference_id || "-"}</li>
              <li><strong>Monto:</strong> ${opts.amount != null ? `${opts.amount} ${opts.currency_id || ""}` : "-"}</li>
              <li><strong>Payer:</strong> ${opts.payer_email || "-"}</li>
              <li><strong>Estado:</strong> ${opts.status || "-"}</li>
            </ul>
          </div>`;

        await transporter.sendMail({ from, to, subject, text, html });
      } catch (e) {
        console.warn("/api/mp/verify admin email warning", (e as any)?.message || e);
      }
    }

    // If we have payment_id, fetch payment directly
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

      // Enviar correo si aprobado y se indicó notify=true
      if (notify === "true") {
        await sendAdminEmailOnApproved({
          status: data.status,
          payment_id: data.id,
          preference_id: data.metadata?.preference_id || data.preference_id,
          amount: data.transaction_amount,
          currency_id: data.currency_id,
          payer_email: data.payer?.email || null,
        });
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

    // Otherwise, fallback: search by preference_id in payments search
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

    // Enviar correo si aprobado y se indicó notify=true
    if (notify === "true") {
      await sendAdminEmailOnApproved({
        status: result.status,
        payment_id: result.id,
        preference_id: result.preference_id,
        amount: result.transaction_amount,
        currency_id: result.currency_id,
        payer_email: result.payer?.email || null,
      });
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