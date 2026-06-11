export const MAX_SAMPLE_UNITS_TOTAL = 30;
export const MAX_SAMPLE_UNITS_PER_ITEM = 5;

type CartLikeItem = {
  id?: string | null;
  name?: string | null;
  qty?: number | string | null;
  quantity?: number | string | null;
  product?: string | null;
};

function getItemQty(item: CartLikeItem): number {
  const raw = item.qty ?? item.quantity ?? 0;
  const qty = Number(raw);
  return Number.isFinite(qty) ? qty : 0;
}

function getItemLabel(item: CartLikeItem, index: number): string {
  return item.name || item.product || item.id || `Producto ${index + 1}`;
}

export function validateSampleCart(items: CartLikeItem[]) {
  const normalizedItems = Array.isArray(items) ? items : [];
  const totalUnits = normalizedItems.reduce((sum, item) => sum + getItemQty(item), 0);
  const invalidItem = normalizedItems.find((item) => getItemQty(item) > MAX_SAMPLE_UNITS_PER_ITEM);

  if (totalUnits <= 0) {
    return {
      ok: false as const,
      error: "Seleccione al menos un producto.",
    };
  }

  if (totalUnits > MAX_SAMPLE_UNITS_TOTAL) {
    return {
      ok: false as const,
      error: `Máximo ${MAX_SAMPLE_UNITS_TOTAL} unidades de muestra en total.`,
    };
  }

  if (invalidItem) {
    const itemIndex = normalizedItems.indexOf(invalidItem);
    return {
      ok: false as const,
      error: `Máximo ${MAX_SAMPLE_UNITS_PER_ITEM} unidades por item (${getItemLabel(invalidItem, itemIndex)}).`,
    };
  }

  return {
    ok: true as const,
    totalUnits,
  };
}
