// Configurable tabla de costos de envío por provincia (ARS)
// Editá los valores según tus tarifas. 0 son placeholders.
// Usado tanto en el cliente (UI) como en el servidor (emails/cálculo seguro).
export const SHIPPING_FEES: Record<string, number> = {
  "CABA": 4810,
  "GBA Gran Buenos Aires": 8279,
  "Buenos Aires Interior": 12542,
  "Catamarca": 15760,
  "Chaco": 15760,
  "Chubut": 17459,
  "Córdoba": 12542,
  "Corrientes": 15760,
  "Entre Ríos": 13125,
  "Formosa": 15760,
  "Jujuy": 15760,
  "La Pampa": 13125,
  "La Rioja": 15760,
  "Mendoza": 13125,
  "Misiones": 15760,
  "Neuquén": 15760,
  "Río Negro": 17459,
  "Salta": 15760,
  "San Juan": 13125,
  "San Luis": 13125,
  "Santa Cruz": 17459,
  "Santa Fe": 12542,
  "Santiago del Estero": 15760,
  "Tierra del Fuego": 33220,
  "Tucumán": 13125,
};

export function getShippingFee(provincia?: string): number | null {
  if (!provincia) return null;
  const fee = SHIPPING_FEES[provincia];
  return typeof fee === "number" ? fee : null;
}