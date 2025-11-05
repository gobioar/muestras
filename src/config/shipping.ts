// Configurable tabla de costos de envío por provincia (ARS)
// Editá los valores según tus tarifas. 0 son placeholders.
// Usado tanto en el cliente (UI) como en el servidor (emails/cálculo seguro).
export const SHIPPING_FEES: Record<string, number> = {
  "CABA": 4868,
  "GBA Gran Buenos Aires": 7150,
  "Buenos Aires Interior": 13069,
  "Catamarca": 16427,
  "Chaco": 16427,
  "Chubut": 18189,
  "Córdoba": 13069,
  "Corrientes": 16427,
  "Entre Ríos": 13690,
  "Formosa": 16427,
  "Jujuy": 16427,
  "La Pampa": 13690,
  "La Rioja": 16427,
  "Mendoza": 13690,
  "Misiones": 16427,
  "Neuquén": 16427,
  "Río Negro": 18189,
  "Salta": 16427,
  "San Juan": 13690,
  "San Luis": 13690,
  "Santa Cruz": 18189,
  "Santa Fe": 13069,
  "Santiago del Estero": 16427,
  "Tierra del Fuego": 34622,
  "Tucumán": 13690,
};

export function getShippingFee(provincia?: string): number | null {
  if (!provincia) return null;
  const fee = SHIPPING_FEES[provincia];
  return typeof fee === "number" ? fee : null;
}