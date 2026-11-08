// Ícono de cada categoría según su nombre (para la app en el celular). Sirve en el servidor y en el navegador.
export type CatIcon = "cart" | "fuel" | "bolt" | "tractor" | "heart" | "home" | "grain" | "wallet" | "card" | "bank" | "spark" | "repeat" | "file" | "dots";

const RULES: [RegExp, CatIcon][] = [
  [/cereal|soja|ma[ií]z|trigo|girasol|cosecha|grano/i, "grain"],
  [/s[uú]per|aliment|almac|delivery|carnicer|verduler|comida/i, "cart"],
  [/nafta|combust|gasoil|transporte|peaje|auto|camioneta/i, "fuel"],
  [/luz|gas\b|servicio|internet|celular|agua|tel[eé]fono/i, "bolt"],
  [/campo|agro|semilla|fertiliz|veterin|maquinaria|hacienda/i, "tractor"],
  [/salud|farmacia|prepaga|m[eé]dic|odont/i, "heart"],
  [/vivienda|alquiler|expensas|hogar|mantenimiento|casa/i, "home"],
  [/sueldo|salario|honorario|jubila|ingreso/i, "wallet"],
  [/tarjeta|cuota/i, "card"],
  [/banco|impuesto|seguro|inter[eé]s/i, "bank"],
  [/entreten|salida|viaje|regalo/i, "spark"],
  [/suscrip/i, "repeat"],
  [/educa|escuela|curso/i, "file"],
];

export function categoryIcon(name: string | null | undefined): CatIcon {
  if (!name) return "dots";
  for (const [re, icon] of RULES) if (re.test(name)) return icon;
  return "dots";
}

// Colores suaves por tipo de ícono (fondo y trazo), con buena lectura en claro y oscuro.
export const ICON_TONE: Record<CatIcon, "g" | "b" | "a" | "r" | "s"> = {
  grain: "g", wallet: "g", home: "g", cart: "b", card: "b", bank: "b", repeat: "b", file: "b",
  fuel: "a", bolt: "a", tractor: "a", spark: "a", heart: "r", dots: "s",
};
