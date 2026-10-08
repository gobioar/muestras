"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Minus, Trash2, Package, Truck, User, Search, X } from "lucide-react";
import { getShippingFee } from "@/config/shipping";
import { SKUS } from "@/config/skus";
import { MAX_SAMPLE_UNITS_PER_ITEM, MAX_SAMPLE_UNITS_TOTAL } from "@/lib/sample-cart";
import { useRouter } from "next/navigation";

type ProductSelection = {
  product: string;
  quantity: string;
};

type Errors = Partial<Record<string, string>>;

function generateClientId() {
  const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `GB-${Date.now().toString().slice(-6)}-${rnd}`;
}

const CATEGORIES = [
  "Estuches",
  "Bandejas",
  "Bowls",
  "Vasos",
  "Platos",
  "Cubiertos",
  "Accesorios",
  "Bolsas",
] as const;

type Category = (typeof CATEGORIES)[number];

type CatalogItem = {
  id: string;
  name: string;
  category: Category;
  // Subtítulo para separar tipos dentro de una misma categoría
  group?: string;
};

// Miniatura con fallback y prioridad opcional
function ProductThumb({
  id,
  alt,
  className = "",
  priority = false,
}: {
  id: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  const candidates = [
    `/images/products/${id}/cover.webp`,
    `/images/products/${id}/cover.jpg`,
    `/images/products/${id}/cover.png`,
    `/images/products/${id}/1.webp`,
    `/images/products/${id}/1.jpg`,
    `/images/products/${id}/1.png`,
  ];
  const [srcIdx, setSrcIdx] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);
  const src =
    srcIdx < candidates.length
      ? candidates[srcIdx]
      : "/images/products/placeholder.svg";
  const nextCandidate = () =>
    setSrcIdx((i) => (i < candidates.length ? i + 1 : i));

  // En la primera carga la imagen viene del HTML del servidor y puede fallar
  // antes de que React registre onError; en ese caso pasamos al siguiente candidato.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) nextCandidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return (
    <img
      key={src} // fuerza remount al cambiar src
      ref={imgRef}
      src={src}
      alt={alt}
      onError={nextCandidate}
      className={`${className} object-cover rounded-lg border border-[color:var(--gb-border-soft)] bg-[color:var(--gb-bg-soft)]`}
      width={56}
      height={56}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
    />
  );
}

const CATALOG: CatalogItem[] = [
  // Accesorios
  { id: "acc-portavaso-doble-universal", name: "Portavaso Doble Universal", category: "Accesorios" },
  { id: "acc-portavaso-doble-valija-carry-trade", name: "Portavaso Doble Valija (Carry Tray)", category: "Accesorios" },
  { id: "acc-collarin-multi-medida", name: "Collarín Multi Medida", category: "Accesorios" },
  { id: "acc-sorbete-n-23cm-9mm", name: "Sorbete 23cm (ø9mm) Natural", category: "Accesorios" },
  { id: "acc-sorbete-b-23cm-9mm", name: "Sorbete 23cm (ø9mm) Blanco", category: "Accesorios" },
  { id: "acc-revolvedor-madera-15cm", name: "Revolvedor 15cm", category: "Accesorios" },

  // Bandejas
  { id: "ban-850", name: "Bandeja 850", category: "Bandejas" },
  { id: "ban-tapa-850", name: "Tapa Bandeja 850", category: "Bandejas" },
  { id: "ban-102-300ml-14x11x3-fibra", name: "Bandeja 102 (300ml / 14x11x3cm)", category: "Bandejas" },
  { id: "ban-tapa-102-pet", name: "Tapa Bandeja 102", category: "Bandejas" },
  { id: "ban-103-550ml-18x12x3-fibra", name: "Bandeja 103 Baja (550ml / 18x12x3cm)", category: "Bandejas" },
  { id: "ban-tapa-103-pet", name: "Tapa Bandeja 103 Baja", category: "Bandejas" },
  { id: "ban-105-900ml-18x15x4-fibra", name: "Bandeja 105 Baja (900ml / 18x15x4cm)", category: "Bandejas" },
  { id: "ban-tapa-105-pet", name: "Tapa Bandeja 105 Baja", category: "Bandejas" },
  { id: "ban-105-ovalada-750ml-22x14x4-fibra", name: "Bandeja 105 Ovalada (750ml / 22x14x4cm)", category: "Bandejas" },
  { id: "ban-tapa-ovalada-pet", name: "Tapa Bandeja Ovalada", category: "Bandejas" },
  { id: "ban-103-alta-650ml-16x12x5-fibra", name: "Bandeja 103 Alta (650ml / 16x12x5cm)", category: "Bandejas" },
  { id: "ban-tapa-103-alta-pet", name: "Tapa Bandeja 103 Alta", category: "Bandejas" },
  { id: "ban-105-alta-1100ml-23x15x4-fibra", name: "Bandeja 105 Alta (1100ml / 23x15x4cm)", category: "Bandejas" },
  { id: "ban-tapa-105-alta-pet", name: "Tapa Bandeja 105 Alta", category: "Bandejas" },

  // Bowls
  { id: "bow-1000-blanco", name: "Bowl 1000", category: "Bowls" },
  { id: "bow-tapa-1000-blanco", name: "Tapa Bowl 1000", category: "Bowls" },
  { id: "bow-850", name: "Bowl 850", category: "Bowls" },
  { id: "bow-tapa-850", name: "Tapa Bowl 850", category: "Bowls" },
  { id: "bow-500", name: "Bowl 500", category: "Bowls" },
  { id: "bow-tapa-500", name: "Tapa Bowl 500", category: "Bowls" },
  { id: "bow-250", name: "Bowl 250", category: "Bowls" },
  { id: "bow-tapa-250", name: "Tapa Bowl 250", category: "Bowls" },
  { id: "bow-dip-2oz", name: "Dip 2oz", category: "Bowls" },
  { id: "bow-tapa-dip-2oz", name: "Tapa Dip 2oz", category: "Bowls" },
  { id: "bow-1000-fibra", name: "Bowl 1000 Natural", category: "Bowls" },
  { id: "bow-tapa-1000-fibra", name: "Tapa Bowl 1000 Transparente", category: "Bowls" },
  { id: "bow-500-fibra", name: "Bowl 500 Natural", category: "Bowls" },
  { id: "bow-tapa-500-fibra", name: "Tapa Bowl 500 Transparente", category: "Bowls" },
  { id: "bow-850-fibra", name: "Bowl 850 Natural", category: "Bowls" },
  { id: "bow-tapa-850-fibra", name: "Tapa Bowl 850 Transparente", category: "Bowls" },

  // Cubiertos
  { id: "cub-cuchillo-madera-16cm", name: "Cuchillo 16cm", category: "Cubiertos" },
  { id: "cub-cuchara-madera-16cm", name: "Cuchara 16cm", category: "Cubiertos" },
  { id: "cub-tenedor-madera-16cm", name: "Tenedor 16cm", category: "Cubiertos" },

  // Estuches
  { id: "est-1250-3-comp", name: "Estuche 1250 con 3 Compartimentos", category: "Estuches" },
  { id: "est-950-alto", name: "Estuche 950 Alto", category: "Estuches" },
  { id: "est-950-bajo", name: "Estuche 950 Bajo", category: "Estuches" },
  { id: "est-600-rect", name: "Estuche 600 Rectangular", category: "Estuches" },
  { id: "est-500-cuadrado", name: "Estuche 500 Cuadrado", category: "Estuches" },

  // Platos
  { id: "pla-17cm-bagazo-natural", name: "Plato 17cm Natural", category: "Platos" },
  { id: "pla-17cm-bagazo-blanco", name: "Plato 17cm Blanco", category: "Platos" },
  { id: "pla-22cm-bagazo-natural", name: "Plato 22cm Natural", category: "Platos" },
  { id: "pla-22cm-bagazo-blanco", name: "Plato 22cm Blanco", category: "Platos" },

  // Vasos
  { id: "vaso-8oz", name: "Vaso 8oz (240ml)", category: "Vasos" },
  { id: "tapa-vaso-8oz", name: "Tapa Vaso 8oz", category: "Vasos" },
  { id: "vaso-12oz", name: "Vaso 12oz (355ml)", category: "Vasos" },
  { id: "tapa-vaso-12oz", name: "Tapa Vaso 12oz", category: "Vasos" },
  { id: "vaso-14oz", name: "Vaso 14oz (415ml)", category: "Vasos" },
  { id: "tapa-vaso-14oz", name: "Tapa Vaso 14oz", category: "Vasos" },
  { id: "vaso-4oz", name: "Vaso 4oz (120ml)", category: "Vasos" },

  // Bolsas (cada medida se ofrece sin impresión y con impresión GoBio de referencia)
  { id: "bolsa-arranque-20x20", name: "Bolsa de Arranque 20x20 (sin impresión)", category: "Bolsas", group: "Bolsas de arranque" },
  { id: "bolsa-arranque-20x20-impresa", name: "Bolsa de Arranque 20x20 (con impresión)", category: "Bolsas", group: "Bolsas de arranque" },
  { id: "bolsa-arranque-20x30", name: "Bolsa de Arranque 20x30 (sin impresión)", category: "Bolsas", group: "Bolsas de arranque" },
  { id: "bolsa-arranque-20x30-impresa", name: "Bolsa de Arranque 20x30 (con impresión)", category: "Bolsas", group: "Bolsas de arranque" },
  { id: "bolsa-arranque-30x40", name: "Bolsa de Arranque 30x40 (sin impresión)", category: "Bolsas", group: "Bolsas de arranque" },
  { id: "bolsa-arranque-30x40-impresa", name: "Bolsa de Arranque 30x40 (con impresión)", category: "Bolsas", group: "Bolsas de arranque" },
  { id: "bolsa-camiseta-20x30", name: "Bolsa Camiseta 20x30 (sin impresión)", category: "Bolsas", group: "Bolsas camiseta" },
  { id: "bolsa-camiseta-20x30-impresa", name: "Bolsa Camiseta 20x30 (con impresión)", category: "Bolsas", group: "Bolsas camiseta" },
  { id: "bolsa-camiseta-30x40", name: "Bolsa Camiseta 30x40 (sin impresión)", category: "Bolsas", group: "Bolsas camiseta" },
  { id: "bolsa-camiseta-30x40-impresa", name: "Bolsa Camiseta 30x40 (con impresión)", category: "Bolsas", group: "Bolsas camiseta" },
  { id: "bolsa-camiseta-40x50", name: "Bolsa Camiseta 40x50 (sin impresión)", category: "Bolsas", group: "Bolsas camiseta" },
  { id: "bolsa-camiseta-40x50-impresa", name: "Bolsa Camiseta 40x50 (con impresión)", category: "Bolsas", group: "Bolsas camiseta" },
  { id: "bolsa-rinon-20x30", name: "Bolsa Riñón 20x30 (sin impresión)", category: "Bolsas", group: "Bolsas riñón" },
  { id: "bolsa-rinon-20x30-impresa", name: "Bolsa Riñón 20x30 (con impresión)", category: "Bolsas", group: "Bolsas riñón" },
  { id: "bolsa-rinon-30x40", name: "Bolsa Riñón 30x40 (sin impresión)", category: "Bolsas", group: "Bolsas riñón" },
  { id: "bolsa-rinon-30x40-impresa", name: "Bolsa Riñón 30x40 (con impresión)", category: "Bolsas", group: "Bolsas riñón" },
  { id: "bolsa-rinon-40x50", name: "Bolsa Riñón 40x50 (sin impresión)", category: "Bolsas", group: "Bolsas riñón" },
  { id: "bolsa-rinon-40x50-impresa", name: "Bolsa Riñón 40x50 (con impresión)", category: "Bolsas", group: "Bolsas riñón" },
];

// Mapas de Material por producto (tus claves actuales)
const MATERIALS: Record<string, string> = {
  // Accesorios
  "Portavaso Doble Universal": "Papel Kraft",
  "Portavaso Doble Valija (Carry Tray)": "Papel Kraft",
  "Collarín Multi Medida": "Papel Kraft",
  "Sorbete 23cm (ø9mm) Natural": "Papel Kraft",
  "Sorbete 23cm (ø9mm) Blanco": "Papel Kraft",
  "Revolvedor 15cm": "Madera",
  // Bandejas
  "Bandeja 850": "Bagazo de Caña de Azúcar",
  "Tapa Bandeja 850": "Bagazo de Caña de Azúcar",
  "Bandeja 102 (300ml / 14x11x3cm)": "Fibra Natural",
  "Tapa Bandeja 102": "PET Cristal",
  "Bandeja 103 Baja (550ml / 18x12x3cm)": "Fibra Natural",
  "Tapa Bandeja 103 Baja": "PET Cristal",
  "Bandeja 105 Baja (900ml / 18x15x4cm)": "Fibra Natural",
  "Tapa Bandeja 105 Baja": "PET Cristal",
  "Bandeja 105 Ovalada (750ml / 22x14x4cm)": "Fibra Natural",
  "Tapa Bandeja Ovalada": "PET Cristal",
  "Bandeja 103 Alta (650ml / 16x12x5cm)": "Fibra Natural",
  "Tapa Bandeja 103 Alta": "PET Cristal",
  "Bandeja 105 Alta (1100ml / 23x15x4cm)": "Fibra Natural",
  "Tapa Bandeja 105 Alta": "PET Cristal",
  // Vasos
  "Vaso 8oz (240ml)": "Bagazo de Caña de Azúcar",
  "Tapa Vaso 8oz": "Bagazo de Caña de Azúcar",
  "Vaso 12oz (355ml)": "Bagazo de Caña de Azúcar",
  "Tapa Vaso 12oz": "Bagazo de Caña de Azúcar",
  "Vaso 14oz (415ml)": "Bagazo de Caña de Azúcar",
  "Tapa Vaso 14oz": "Bagazo de Caña de Azúcar",
  "Vaso 4oz (120ml)": "Bagazo de Caña de Azúcar",
  // Bowls
  "Bowl 1000": "Bagazo de Caña de Azúcar",
  "Tapa Bowl 1000": "Bagazo de Caña de Azúcar",
  "Bowl 850": "Bagazo de Caña de Azúcar",
  "Tapa Bowl 850": "Bagazo de Caña de Azúcar",
  "Bowl 500": "Bagazo de Caña de Azúcar",
  "Tapa Bowl 500": "Bagazo de Caña de Azúcar",
  "Bowl 250": "Bagazo de Caña de Azúcar",
  "Tapa Bowl 250": "Bagazo de Caña de Azúcar",
  "Dip 2oz": "Bagazo de Caña de Azúcar",
  "Tapa Dip 2oz": "Bagazo de Caña de Azúcar",
  "Bowl 1000 Natural": "Fibra Natural",
  "Tapa Bowl 1000 Transparente": "PET Cristal",
  "Bowl 500 Natural": "Fibra Natural",
  "Tapa Bowl 500 Transparente": "PET Cristal",
  "Bowl 850 Natural": "Fibra Natural",
  "Tapa Bowl 850 Transparente": "PET Cristal",
  // Cubiertos
  "Cuchillo 16cm": "Madera de Abedul",
  "Cuchara 16cm": "Madera de Abedul",
  "Tenedor 16cm": "Madera de Abedul",
  // Estuches
  "Estuche 1250 con 3 Compartimentos": "Bagazo de Caña de Azúcar",
  "Estuche 950 Alto": "Bagazo de Caña de Azúcar",
  "Estuche 950 Bajo": "Bagazo de Caña de Azúcar",
  "Estuche 600 Rectangular": "Bagazo de Caña de Azúcar",
  "Estuche 500 Cuadrado": "Bagazo de Caña de Azúcar",
  // Platos
  "Plato 17cm Natural": "Bagazo de Caña de Azúcar",
  "Plato 17cm Blanco": "Bagazo de Caña de Azúcar",
  "Plato 22cm Natural": "Bagazo de Caña de Azúcar",
  "Plato 22cm Blanco": "Bagazo de Caña de Azúcar",
  // bolsas
  "Bolsa de Arranque 20x20 (sin impresión)": "Bioplástico",
  "Bolsa de Arranque 20x20 (con impresión)": "Bioplástico · Impresión GoBio (de referencia)",
  "Bolsa de Arranque 20x30 (sin impresión)": "Bioplástico",
  "Bolsa de Arranque 20x30 (con impresión)": "Bioplástico · Impresión GoBio (de referencia)",
  "Bolsa de Arranque 30x40 (sin impresión)": "Bioplástico",
  "Bolsa de Arranque 30x40 (con impresión)": "Bioplástico · Impresión GoBio (de referencia)",
  "Bolsa Camiseta 20x30 (sin impresión)": "Bioplástico",
  "Bolsa Camiseta 20x30 (con impresión)": "Bioplástico · Impresión GoBio (de referencia)",
  "Bolsa Camiseta 30x40 (sin impresión)": "Bioplástico",
  "Bolsa Camiseta 30x40 (con impresión)": "Bioplástico · Impresión GoBio (de referencia)",
  "Bolsa Camiseta 40x50 (sin impresión)": "Bioplástico",
  "Bolsa Camiseta 40x50 (con impresión)": "Bioplástico · Impresión GoBio (de referencia)",
  "Bolsa Riñón 20x30 (sin impresión)": "Bioplástico",
  "Bolsa Riñón 20x30 (con impresión)": "Bioplástico · Impresión GoBio (de referencia)",
  "Bolsa Riñón 30x40 (sin impresión)": "Bioplástico",
  "Bolsa Riñón 30x40 (con impresión)": "Bioplástico · Impresión GoBio (de referencia)",
  "Bolsa Riñón 40x50 (sin impresión)": "Bioplástico",
  "Bolsa Riñón 40x50 (con impresión)": "Bioplástico · Impresión GoBio (de referencia)",
};

const CATEGORY_LABELS: Record<string, string> = {
  Accesorios: "Accesorios",
  Bandejas: "Bandejas",
  Bolsas: "Bolsas",
  Bowls: "Bowls",
  Cubiertos: "Cubiertos",
  Estuches: "Estuches",
  Platos: "Platos",
  Vasos: "Vasos",
};

// Búsqueda por palabras: sin tildes ni mayúsculas, y tolera plural/singular
// ("vasos" encuentra "Vaso 8oz"). Busca en nombre, categoría, subgrupo y material.
function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function stemWord(word: string) {
  return word.length > 3 ? word.replace(/(es|s)$/, "") : word;
}

function matchesQuery(item: CatalogItem, query: string) {
  const haystack = normalizeText(
    [item.name, CATEGORY_LABELS[item.category] ?? item.category, item.group ?? "", MATERIALS[item.name] ?? ""].join(" ")
  );
  return normalizeText(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word) || haystack.includes(stemWord(word)));
}

export default function GoBioSampleForm() {
  const [form, setForm] = useState({
    nombreApellido: "",
    telefono: "",
    email: "",
    direccion: "",
    localidad: "",
    codigoPostal: "",
    provincia: "",
    empresa: "",
    dniCuit: "",
    products: [
      { product: "", quantity: "" },
      { product: "", quantity: "" },
      { product: "", quantity: "" },
    ] as ProductSelection[],
    comentarios: "",
  });

  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<Category>("Estuches");
  const [cart, setCart] = useState<
    Record<string, { id: string; name: string; category: Category; qty: number }>
  >({});
  const [search, setSearch] = useState("");
  const query = search.trim();
  const visibleItems = (
    query ? CATALOG.filter((p) => matchesQuery(p, query)) : CATALOG.filter((p) => p.category === selectedCategory)
  )
    .map((item, order) => ({ item, order }))
    .sort((a, b) =>
      query ? CATEGORIES.indexOf(a.item.category) - CATEGORIES.indexOf(b.item.category) || a.order - b.order : 0
    )
    .map(({ item }) => item);
  const router = useRouter();

  // Persistir preferencia de categoría
  useEffect(() => {
    try {
      const saved = localStorage.getItem("gobio.selectedCategory");
      const valid = ["Accesorios", "Bandejas", "Bowls", "Cubiertos", "Estuches", "Platos", "Vasos"] as const;
      if (saved && (valid as readonly string[]).includes(saved)) {
        setSelectedCategory(saved as Category);
      }
      const savedProv = localStorage.getItem("gobio.provincia");
      if (savedProv) setForm((f) => ({ ...f, provincia: savedProv }));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("gobio.selectedCategory", selectedCategory);
    } catch {}
  }, [selectedCategory]);

  useEffect(() => {
    try {
      if (form.provincia) localStorage.setItem("gobio.provincia", form.provincia);
    } catch {}
  }, [form.provincia]);

  const setField = (field: string, value: any) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const setProduct = (index: number, key: keyof ProductSelection, value: string) => {
    setForm((f) => {
      const products = [...f.products];
      products[index] = { ...products[index], [key]: value } as ProductSelection;
      return { ...f, products };
    });
  };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

  const inc = (item: CatalogItem) => {
    setCart((c) => {
      const current = c[item.id]?.qty || 0;
      const currentTotal = Object.values(c).reduce((sum, it) => sum + it.qty, 0);
      if (currentTotal >= MAX_SAMPLE_UNITS_TOTAL) return c;
      if (current >= MAX_SAMPLE_UNITS_PER_ITEM) return c;
      return { ...c, [item.id]: { id: item.id, name: item.name, category: item.category, qty: current + 1 } };
    });
  };
  const dec = (item: CatalogItem) => {
    setCart((c) => {
      const current = c[item.id]?.qty || 0;
      const next = Math.max(0, current - 1);
      const nextCart = { ...c };
      if (next === 0) delete nextCart[item.id];
      else nextCart[item.id] = { id: item.id, name: item.name, category: item.category, qty: next };
      return nextCart;
    });
  };
  const removeFromCart = (id: string) => {
    setCart((c) => {
      const n = { ...c };
      delete n[id];
      return n;
    });
  };
  const totalUnits = Object.values(cart).reduce((sum, it) => sum + it.qty, 0);

  const shippingFee = getShippingFee(form.provincia);

  const validate = (): boolean => {
    const e: Errors = {};
    if (!form.nombreApellido.trim()) e.nombreApellido = "Campo obligatorio.";
    if (!form.telefono.trim()) e.telefono = "Campo obligatorio.";
    if (!form.email.trim()) e.email = "Campo obligatorio.";
    else if (!emailRegex.test(form.email.trim())) e.email = "El correo no tiene un formato válido.";

    if (!form.direccion.trim()) e.direccion = "Campo obligatorio.";
    if (!form.localidad.trim()) e.localidad = "Campo obligatorio.";
    if (!form.codigoPostal.trim()) e.codigoPostal = "Campo obligatorio.";
    if (!form.provincia) e.provincia = "Seleccione una provincia.";
    if (!form.empresa.trim()) e.empresa = "Campo obligatorio.";
    if (!form.dniCuit.trim()) e.dniCuit = "Campo obligatorio.";

    if (totalUnits <= 0) e.productCart = "Seleccione al menos un producto.";
    if (totalUnits > MAX_SAMPLE_UNITS_TOTAL) e.productCart = "Máximo 30 unidades de muestra en total.";

    const invalidItem = Object.values(cart).find((it) => it.qty > MAX_SAMPLE_UNITS_PER_ITEM);
    if (invalidItem) e.productCart = `Máximo ${MAX_SAMPLE_UNITS_PER_ITEM} unidades por item (${invalidItem.name}).`;

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const goToResumen = async (e?: React.FormEvent) => {
  e?.preventDefault();
  setServerError(null);
  setSuccess(null);

  if (!validate()) {
    setServerError("Revise los campos obligatorios.");
    return;
  }

  try {
    setSubmitting(true);

    const clientId = generateClientId();
    const cartPayload = Object.values(cart).map((it) => ({
      id: it.id,
      name: it.name,
      category: it.category,
      qty: it.qty,
      sku: SKUS[it.id] || "",
    }));

    const payload = {
      form,
      cart: cartPayload,
      clientId,
      provincia: form.provincia,
      shippingFee,
    };

    try {
      localStorage.setItem("gobio.checkout", JSON.stringify(payload));
    } catch {}

    router.push("/resumen-pago");
  } finally {
    setSubmitting(false);
  }
};

  return (
    <Card className="max-w-[1180px] mx-auto shadow-sm rounded-2xl border border-[color:var(--gb-border-soft)]">
      <CardHeader className="pb-4">
        <CardTitle className="text-[28px] leading-[36px] sm:text-[36px] sm:leading-[44px] font-semibold text-[color:var(--gb-neutral-800)]">
          Solicitar muestras de envases ecológicos
        </CardTitle>
        <CardDescription className="text-base leading-6 text-[color:var(--gb-neutral-600)]">
          GoBio ofrece muestras sin costo para evaluación de calidad y compatibilidad con su operación. Complete el formulario para coordinar el envío.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form id="paso1" onSubmit={goToResumen} className="space-y-8">
          <section className="space-y-4">
            <h3 className="text-[22px] leading-[28px] font-semibold text-[color:var(--gb-neutral-800)]">Cómo funciona</h3>
            <div className="grid gap-6 sm:grid-cols-3">
              <div className="flex flex-col items-center text-center">
                <Package className="h-10 w-10 text-[#CAD2DD]" />
                <p className="mt-3 text-sm text-[color:var(--gb-neutral-800)]">Las muestras no tienen costo</p>
              </div>
              <div className="flex flex-col items-center text-center">
                <Truck className="h-10 w-10 text-[#CAD2DD]" />
                <p className="mt-3 text-sm text-[color:var(--gb-neutral-800)]">Solo se abona el envío, que se reintegra en tu primer pedido.</p>
              </div>
              <div className="flex flex-col items-center text-center">
                <User className="h-10 w-10 text-[#CAD2DD]" />
                <p className="mt-3 text-sm text-[color:var(--gb-neutral-800)]">Entrega de 2 a 5 días hábiles</p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-[22px] leading-[28px] font-semibold text-[color:var(--gb-neutral-800)]">Datos de contacto</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="nombreApellido">Nombre y apellido</Label>
                <Input
                  id="nombreApellido"
                  className="h-11 border-[color:var(--gb-neutral-100)] focus-visible:ring-0 focus-visible:border-[color:var(--gb-primary)] focus-visible:shadow-[0_0_0_3px_rgba(50,170,147,0.15)]"
                  placeholder="Ej.: Ana Pérez"
                  value={form.nombreApellido}
                  onChange={(e) => setField("nombreApellido", e.target.value)}
                  required
                />
                {errors.nombreApellido && <p className="text-sm text-destructive">{errors.nombreApellido}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="empresa">Nombre de la empresa</Label>
                <Input
                  id="empresa"
                  className="h-11 border-[color:var(--gb-neutral-100)] focus-visible:ring-0 focus-visible:border-[color:var(--gb-primary)] focus-visible:shadow-[0_0_0_3px_rgba(50,170,147,0.15)]"
                  placeholder="Ej.: Mi Empresa S.A."
                  value={form.empresa}
                  onChange={(e) => setField("empresa", e.target.value)}
                  required
                />
                {errors.empresa && <p className="text-sm text-destructive">{errors.empresa}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="dniCuit">DNI o CUIT</Label>
                <Input
                  id="dniCuit"
                  className="h-11 border-[color:var(--gb-neutral-100)] focus-visible:ring-0 focus-visible:border-[color:var(--gb-primary)] focus-visible:shadow-[0_0_0_3px_rgba(50,170,147,0.15)]"
                  placeholder="Ej.: 12.345.678 o 30-71654304-4"
                  value={form.dniCuit}
                  onChange={(e) => setField("dniCuit", e.target.value)}
                  required
                />
                {errors.dniCuit && <p className="text-sm text-destructive">{errors.dniCuit}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  className="h-11 border-[color:var(--gb-neutral-100)] focus-visible:ring-0 focus-visible:border-[color:var(--gb-primary)] focus-visible:shadow-[0_0_0_3px_rgba(50,170,147,0.15)]"
                  placeholder="Con código de área. Ej.: 11 1234 5678"
                  value={form.telefono}
                  onChange={(e) => setField("telefono", e.target.value)}
                  required
                />
                {errors.telefono && <p className="text-sm text-destructive">{errors.telefono}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  className="h-11 border-[color:var(--gb-neutral-100)] focus-visible:ring-0 focus-visible:border-[color:var(--gb-primary)] focus-visible:shadow-[0_0_0_3px_rgba(50,170,147,0.15)]"
                  placeholder="Ej.: nombre@empresa.com"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  required
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-[22px] leading-[28px] font-semibold text-[color:var(--gb-neutral-800)]">Dirección de entrega</h3>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="direccion">Dirección</Label>
                <Input
                  id="direccion"
                  className="h-11 border-[color:var(--gb-neutral-100)] focus-visible:ring-0 focus-visible:border-[color:var(--gb-primary)] focus-visible:shadow-[0_0_0_3px_rgba(50,170,147,0.15)]"
                  placeholder="Calle y número, piso/depto si corresponde"
                  value={form.direccion}
                  onChange={(e) => setField("direccion", e.target.value)}
                  required
                />
                {errors.direccion && <p className="text-sm text-destructive">{errors.direccion}</p>}
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="localidad">Localidad</Label>
                  <Input
                    id="localidad"
                    className="h-11 border-[color:var(--gb-neutral-100)] focus-visible:ring-0 focus-visible:border-[color:var(--gb-primary)] focus-visible:shadow-[0_0_0_3px_rgba(50,170,147,0.15)]"
                    placeholder="Ej.: Palermo"
                    value={form.localidad}
                    onChange={(e) => setField("localidad", e.target.value)}
                    required
                  />
                  {errors.localidad && <p className="text-sm text-destructive">{errors.localidad}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="provincia">Provincia</Label>
                  <Select value={form.provincia} onValueChange={(v) => setField("provincia", v)}>
                    <SelectTrigger aria-required="true" className="h-11 border-[color:var(--gb-neutral-100)] focus-visible:ring-0 focus-visible:border-[color:var(--gb-primary)]">
                      <SelectValue placeholder="Seleccionar provincia" />
                    </SelectTrigger>
                    <SelectContent>
                      {["CABA","GBA Gran Buenos Aires","Buenos Aires Interior","Catamarca","Chaco","Chubut","Córdoba","Corrientes","Entre Ríos","Formosa","Jujuy","La Pampa","La Rioja","Mendoza","Misiones","Neuquén","Río Negro","Salta","San Juan","San Luis","Santa Cruz","Santa Fe","Santiago del Estero","Tierra del Fuego","Tucumán"].map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.provincia && <p className="text-sm text-destructive">{errors.provincia}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="codigoPostal">Código postal</Label>
                  <Input
                    id="codigoPostal"
                    className="h-11 border-[color:var(--gb-neutral-100)] focus-visible:ring-0 focus-visible:border-[color:var(--gb-primary)] focus-visible:shadow-[0_0_0_3px_rgba(50,170,147,0.15)]"
                    placeholder="Ej.: C1425"
                    value={form.codigoPostal}
                    onChange={(e) => setField("codigoPostal", e.target.value)}
                    required
                  />
                  {errors.codigoPostal && <p className="text-sm text-destructive">{errors.codigoPostal}</p>}
                </div>
              </div>
            </div>

            <div className="mt-2 rounded-xl border border-[color:var(--gb-border-soft)] bg-white p-4">
              <p className="text-sm text-[color:var(--gb-neutral-600)]">Costo de envío</p>
              {form.provincia && shippingFee !== null ? (
                <p className="mt-1 text-[15px] font-semibold text-[color:var(--gb-neutral-800)]">$ {new Intl.NumberFormat("es-AR").format(shippingFee || 0)}</p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Seleccione una provincia para ver el costo de envío.</p>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-[22px] leading-[28px] font-semibold text-[color:var(--gb-neutral-800)]">Selección de muestras</h3>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--gb-neutral-600)]" aria-hidden="true" />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar producto (ej.: vasos, tapa, bowl 500, bolsa)"
                aria-label="Buscar producto"
                className="pl-9 pr-9"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Borrar búsqueda"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-[color:var(--gb-neutral-600)] hover:bg-[rgba(50,170,147,.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gb-primary)]"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSelectedCategory(cat);
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gb-primary)] focus-visible:ring-offset-2 ${
                    !query && selectedCategory === cat
                      ? "bg-[linear-gradient(135deg,#32AA93_0%,#7CBF81_100%)] text-white border-transparent shadow-sm"
                      : "bg-white text-[color:var(--gb-neutral-800)] border-[color:var(--gb-neutral-100)] hover:bg-[rgba(50,170,147,.08)]"
                  }`}
                >
                  {CATEGORY_LABELS[cat] ?? cat}
                </button>
              ))}
            </div>

            <div className="grid md:grid-cols-3 gap-6 items-start">
              <div className="md:col-span-2 grid sm:grid-cols-2 gap-3">
                {query && visibleItems.length === 0 && (
                  <p className="sm:col-span-2 rounded-xl border border-dashed border-[color:var(--gb-border-soft)] p-4 text-sm text-[color:var(--gb-neutral-600)]">
                    No encontramos productos para “{query}”. Probá con otra palabra o elegí una categoría.
                  </p>
                )}
                {visibleItems.map((item, idx, list) => {
                  const qty = cart[item.id]?.qty || 0;
                  const isInitialAboveTheFold = !query && selectedCategory === "Estuches" && idx < 6;
                  const startsCategory = !!query && item.category !== list[idx - 1]?.category;
                  const startsGroup = !!item.group && item.group !== list[idx - 1]?.group;
                  return (
                    <Fragment key={item.id}>
                    {startsCategory && (
                      <h4 className="sm:col-span-2 mt-2 text-lg font-semibold text-[color:var(--gb-neutral-800)]">
                        {CATEGORY_LABELS[item.category] ?? item.category}
                      </h4>
                    )}
                    {startsGroup && (
                      <h4 className="sm:col-span-2 mt-2 border-b border-[color:var(--gb-border-soft)] pb-1 text-base font-semibold text-[color:var(--gb-neutral-800)]">
                        {item.group}
                      </h4>
                    )}
                    <div
                      className="flex items-center justify-between rounded-xl border border-[color:var(--gb-border-soft)] px-3 py-3.5 bg-white transition-all duration-200 ease-out hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-px"
                    >
                      <div className="flex items-center gap-3">
                        <ProductThumb id={item.id} alt={item.name} className="h-14 w-14" priority={isInitialAboveTheFold} />
                        <div>
                          <p className="text-sm font-semibold text-[color:var(--gb-neutral-800)]">{item.name}</p>
                          <p className="text-xs text-[color:var(--gb-neutral-600)]">{MATERIALS[item.name] ?? item.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="icon"
                          variant="secondary"
                          className="h-10 w-10 rounded-full focus-visible:ring-2 focus-visible:ring-[color:var(--gb-primary)] focus-visible:ring-offset-2 transition-transform duration-150 ease-out hover:-translate-y-px"
                          onClick={() => dec(item)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-6 text-center text-sm tabular-nums">{qty}</span>
                        <Button
                          type="button"
                          size="icon"
                          className="h-10 w-10 rounded-full text-white bg-[linear-gradient(135deg,#32AA93_0%,#7CBF81_100%)] hover:brightness-[1.05] focus-visible:ring-2 focus-visible:ring-[color:var(--gb-primary)] focus-visible:ring-offset-2 transition-transform duration-150 ease-out hover:-translate-y-px"
                          onClick={() => inc(item)}
                          disabled={totalUnits >= MAX_SAMPLE_UNITS_TOTAL || qty >= MAX_SAMPLE_UNITS_PER_ITEM}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    </Fragment>
                  );
                })}
              </div>

              <aside className="md:col-span-1 md:sticky md:top-24">
                <div className="rounded-2xl border border-[color:var(--gb-border-soft)] bg-[#FAFAFA] text-secondary-foreground p-5 shadow-sm">
                  <h4 className="text-sm font-semibold mb-3 text-[color:var(--gb-neutral-800)]">Carrito</h4>
                  {Object.values(cart).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay productos seleccionados.</p>
                  ) : (
                    <ul className="space-y-3">
                      {Object.values(cart).map((it) => {
                        const asCatalog: CatalogItem = { id: it.id, name: it.name, category: it.category };
                        return (
                          <li key={it.id} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <ProductThumb id={it.id} alt={it.name} className="h-10 w-10" />
                              <div>
                                <p className="text-sm font-medium text-[color:var(--gb-neutral-800)]">
                                  {it.name}
                                </p>
                                <p className="text-xs text-[color:var(--gb-neutral-600)]">{it.category}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                className="h-9 w-9 rounded-full focus-visible:ring-2 focus-visible:ring-[color:var(--gb-primary)] focus-visible:ring-offset-2"
                                onClick={() => dec(asCatalog)}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="w-6 text-center text-sm tabular-nums">{it.qty}</span>
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                className="h-9 w-9 rounded-full focus-visible:ring-2 focus-visible:ring-[color:var(--gb-primary)] focus-visible:ring-offset-2"
                                onClick={() => inc(asCatalog)}
                                disabled={totalUnits >= MAX_SAMPLE_UNITS_TOTAL || it.qty >= MAX_SAMPLE_UNITS_PER_ITEM}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="focus-visible:ring-2 focus-visible:ring-[color:var(--gb-primary)] focus-visible:ring-offset-2"
                                onClick={() => removeFromCart(it.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <div className="mt-4 pt-3 border-t flex items-center justify-between">
                    <span className="text-sm">Total de unidades (máximo 30, hasta 5 por item)</span>
                    <span className="text-sm font-semibold tabular-nums">{totalUnits}</span>
                  </div>
                </div>
                {errors.productCart && <p className="mt-2 text-sm text-destructive">{errors.productCart}</p>}
              </aside>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-[22px] leading-[28px] font-semibold text-[color:var(--gb-neutral-800)]">Comentarios adicionales (opcional)</h3>
            <Textarea
              id="comentarios"
              className="min-h-28 border-[color:var(--gb-neutral-100)] focus-visible:ring-0 focus-visible:border-[color:var(--gb-primary)] focus-visible:shadow-[0_0_0_3px_rgba(50,170,147,0.15)]"
              placeholder="Especificaciones, usos previstos, dudas…"
              value={form.comentarios}
              onChange={(e) => setField("comentarios", e.target.value)}
            />
          </section>

          {serverError && <div className="text-sm text-destructive" role="alert">{serverError}</div>}
          {success && (
            <div className="text-sm rounded-lg p-3 bg-[rgba(50,170,147,.10)] text-[color:var(--gb-primary)] border border-[color:var(--gb-neutral-100)] whitespace-pre-line" role="status">
              {success}
            </div>
          )}

          <div className="flex items-center gap-4">
            <Button type="submit" disabled={submitting} className="h-12 rounded-xl px-6 bg-[linear-gradient(135deg,#32AA93_0%,#7CBF81_100%)] hover:brightness-[1.03] disabled:opacity-40">
              {submitting ? "Procesando…" : "Próximo Paso"}
            </Button>
            <span className="text-sm text-muted-foreground">Continuar a resumen y pago</span>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
