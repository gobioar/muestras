// Configurable tabla de costos de envio por provincia (ARS)
// Edita los valores segun tus tarifas. 0 son placeholders.
// Usado tanto en el cliente (UI) como en el servidor (emails/calculo seguro).
// El codigo al final de cada linea es el SKU de la muestra por zona.
export const SHIPPING_FEES: Record<string, number> = {
  "CABA": 5431, // M-CABA
  "GBA Gran Buenos Aires": 10530, // M-GBA1
  "Buenos Aires Interior": 17595, // M-BsAs
  "Catamarca": 22170, // M-Catam
  "Chaco": 22170, // M-Chac
  "Chubut": 24587, // M-Chub
  "Córdoba": 17595, // M-Cor
  "Corrientes": 22170, // M-Corrí
  "Entre Ríos": 18422, // M-ERios
  "Formosa": 22170, // M-Form
  "Jujuy": 22170, // M-Jujuy
  "La Pampa": 18422, // M-LaPam
  "La Rioja": 22170, // M-LaRio
  "Mendoza": 18422, // M-Mend
  "Misiones": 22170, // M-Misio
  "Neuquén": 22170, // M-Neuq
  "Río Negro": 24587, // M-RioN
  "Salta": 22170, // M-Salta
  "San Juan": 18422, // M-SanJ
  "San Luis": 18422, // M-SanL
  "Santa Cruz": 24587, // M-SCruz
  "Santa Fe": 17595, // M-StaFe
  "Santiago del Estero": 22170, // M-SdEst
  "Tierra del Fuego": 46999, // M-TdFueg
  "Tucumán": 18422, // M-Tucu
};

export function getShippingFee(provincia?: string): number | null {
  if (!provincia) return null;
  const fee = SHIPPING_FEES[provincia];
  return typeof fee === "number" ? fee : null;
}
