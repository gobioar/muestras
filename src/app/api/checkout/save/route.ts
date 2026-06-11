import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { validateSampleCart } from "@/lib/sample-cart";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { clientId, form, cart, shippingFee } = body;

    if (!clientId) {
      return NextResponse.json(
        { error: "clientId requerido" },
        { status: 400 }
      );
    }

    const cartValidation = validateSampleCart(Array.isArray(cart) ? cart : []);
    if (!cartValidation.ok) {
      return NextResponse.json(
        { error: cartValidation.error },
        { status: 400 }
      );
    }

    const { error } = await supabaseServer.from("sample_orders").insert([
      {
        client_id: clientId,
        status: "pending_payment",
        email: form?.email,
        nombre_apellido: form?.nombreApellido,
        telefono: form?.telefono,
        empresa: form?.empresa,
        dni_cuit: form?.dniCuit,
        direccion: form?.direccion,
        localidad: form?.localidad,
        codigo_postal: form?.codigoPostal,
        provincia: form?.provincia,
        comentarios: form?.comentarios,
        shipping_fee: shippingFee || 0,
        products_json: cart || [],
      },
    ]);

    if (error) {
      console.error("DB insert error", error);
      return NextResponse.json(
        { error: "Error guardando orden" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Error inesperado" },
      { status: 500 }
    );
  }
}
