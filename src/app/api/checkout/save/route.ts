import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { validateSampleCart } from "@/lib/sample-cart";
import { getShippingFee } from "@/config/shipping";

// Recorta los textos del formulario para no guardar valores arbitrariamente largos
function clean(value: unknown, max = 500) {
  if (value == null) return value as null | undefined;
  return String(value).trim().slice(0, max);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { clientId, form, cart, shippingFee } = body;

    if (typeof clientId !== "string" || !clientId || clientId.length > 100) {
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
        email: clean(form?.email),
        nombre_apellido: clean(form?.nombreApellido),
        telefono: clean(form?.telefono),
        empresa: clean(form?.empresa),
        dni_cuit: clean(form?.dniCuit),
        direccion: clean(form?.direccion),
        localidad: clean(form?.localidad),
        codigo_postal: clean(form?.codigoPostal),
        provincia: clean(form?.provincia),
        comentarios: clean(form?.comentarios, 2000),
        shipping_fee: getShippingFee(form?.provincia) ?? (shippingFee || 0),
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
