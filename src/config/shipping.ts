// Configurable tabla de costos de envío por provincia (ARS)
// Editá los valores según tus tarifas. 0 son placeholders.
// Usado tanto en el cliente (UI) como en el servidor (emails/cálculo seguro).
export const SHIPPING_FEES: Record<string, number> = {
  "CABA": 4868,
  "GBA Gran Buenos Aires": 8338,
  "Buenos Aires Interior": 14859,
  "Catamarca": 17648,
  "Chaco": 17648,
  "Chubut": 19680,
  "Córdoba": 13801,
  "Corrientes": 17648,
  "Entre Ríos": 14497,
  "Formosa": 17648,
  "Jujuy": 17648,
  "La Pampa": 14497,
  "La Rioja": 17648,
  "Mendoza": 14497,
  "Misiones": 17648,
  "Neuquén": 17648,
  "Río Negro": 19680,
  "Salta": 17648,
  "San Juan": 14497,
  "San Luis": 14497,
  "Santa Cruz": 19680,
  "Santa Fe": 13801,
  "Santiago del Estero": 17648,
  "Tierra del Fuego": 38524,
  "Tucumán": 14497,
};

export function getShippingFee(provincia?: string): number | null {
  if (!provincia) return null;
  const fee = SHIPPING_FEES[provincia];
  return typeof fee === "number" ? fee : null;
}