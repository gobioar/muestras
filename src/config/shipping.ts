// Configurable tabla de costos de envio por provincia (ARS)
// Edita los valores segun tus tarifas. 0 son placeholders.
// Usado tanto en el cliente (UI) como en el servidor (emails/calculo seguro).
export const SHIPPING_FEES: Record<string, number> = {
  "CABA": 4868,
  "GBA Gran Buenos Aires": 8338,
  "Buenos Aires Interior": 15846,
  "Catamarca": 19968,
  "Chaco": 19968,
  "Chubut": 22145,
  "Córdoba": 15846,
  "Corrientes": 19968,
  "Entre Ríos": 16591,
  "Formosa": 19968,
  "Jujuy": 19968,
  "La Pampa": 16591,
  "La Rioja": 19968,
  "Mendoza": 16591,
  "Misiones": 19968,
  "Neuquén": 19968,
  "Río Negro": 22145,
  "Salta": 19968,
  "San Juan": 16591,
  "San Luis": 16591,
  "Santa Cruz": 22145,
  "Santa Fe": 15846,
  "Santiago del Estero": 19968,
  "Tierra del Fuego": 42336,
  "Tucumán": 16591,
};

export function getShippingFee(provincia?: string): number | null {
  if (!provincia) return null;
  const fee = SHIPPING_FEES[provincia];
  return typeof fee === "number" ? fee : null;
}
