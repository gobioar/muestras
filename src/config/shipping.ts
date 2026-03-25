// Configurable tabla de costos de envío por provincia (ARS)
// Editá los valores según tus tarifas. 0 son placeholders.
// Usado tanto en el cliente (UI) como en el servidor (emails/cálculo seguro).
export const SHIPPING_FEES: Record<string, number> = {
  "CABA": 4868,
  "GBA Gran Buenos Aires": 8338,
  "Buenos Aires Interior": 15846,
  "Catamarca": 18910,
  "Chaco": 18910,
  "Chubut": 21087,
  "Córdoba": 14788,
  "Corrientes": 18910,
  "Entre Ríos": 15533,
  "Formosa": 18910,
  "Jujuy": 18910,
  "La Pampa": 15533,
  "La Rioja": 18910,
  "Mendoza": 15533,
  "Misiones": 18910,
  "Neuquén": 18910,
  "Río Negro": 21087,
  "Salta": 18910,
  "San Juan": 15533,
  "San Luis": 15533,
  "Santa Cruz": 21087,
  "Santa Fe": 14788,
  "Santiago del Estero": 18910,
  "Tierra del Fuego": 41278,
  "Tucumán": 15533,
};

export function getShippingFee(provincia?: string): number | null {
  if (!provincia) return null;
  const fee = SHIPPING_FEES[provincia];
  return typeof fee === "number" ? fee : null;
}