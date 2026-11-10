// Texto para buscar sin distinguir acentos ni mayúsculas (se usa en el servidor y en el navegador).
export const searchText = (...parts: (string | null | undefined)[]) =>
  parts.filter(Boolean).join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
