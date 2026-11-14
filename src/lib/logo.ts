// Logo de Somos Guafra: la "g" con la curva que sube y tres barras que crecen. Un solo dibujo para todo:
// el ícono del sitio, los de la app instalada, el de iPhone, la imagen para compartir y la marca del encabezado.
export const LOGO = {
  dark: "#16493A",
  bars: ["#4A8669", "#5D9C7C", "#8EC4A0"],
  cream: "#FBF6E8",
  viewBox: "400 236 500 488",
};

// Partes del dibujo (en el sistema de coordenadas de viewBox).
export const LOGO_PARTS: { d: string; fill: string; evenodd?: boolean }[] = [
  // La "g": el óvalo con su agujero y el palito de la derecha; abajo la corta la curva.
  { d: "M530 542Q690 490 800 420L800 285Q800 252 768 252L745 252Q714 252 712 282C690 262 660 252 625 252C520 252 452 330 452 420C452 478 485 520 530 542ZM628 318A80 80 0 1 0 628.01 318Z", fill: LOGO.dark, evenodd: true },
  // La curva que sube (cola de la "g").
  { d: "M420 708L540 708Q526 662 545 625C575 580 640 555 720 515Q820 462 885 370Q822 452 720 492C620 532 482 562 440 615Q410 655 420 708Z", fill: LOGO.dark },
  // Las tres barras.
  { d: "M572 708Q562 708 562 698L562 650Q562 630 588 619L628 604Q652 596 652 620L652 698Q652 708 642 708Z", fill: LOGO.bars[0] },
  { d: "M686 708Q676 708 676 698L676 600Q676 582 700 572L735 560Q757 553 757 576L757 698Q757 708 747 708Z", fill: LOGO.bars[1] },
  { d: "M790 708Q780 708 780 698L780 528Q780 508 805 497L840 484Q865 476 865 500L865 698Q865 708 855 708Z", fill: LOGO.bars[2] },
];

// El logo como SVG en texto. bg: color del fondo (o null, transparente); pad: margen alrededor (0 a 0,4);
// radius: redondeo de las esquinas del fondo (0 a 0,5).
export function logoSvg({ bg = LOGO.cream as string | null, pad = 0.14, radius = 0.22, size = 512 } = {}) {
  const [x, y, w, h] = LOGO.viewBox.split(" ").map(Number);
  const side = Math.max(w, h) / (1 - pad * 2);
  const ox = x - (side - w) / 2, oy = y - (side - h) / 2;
  const rect = bg ? `<rect x="${ox}" y="${oy}" width="${side}" height="${side}" rx="${side * radius}" fill="${bg}"/>` : "";
  const parts = LOGO_PARTS.map((p) => `<path d="${p.d}" fill="${p.fill}"${p.evenodd ? ' fill-rule="evenodd"' : ""}/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${ox} ${oy} ${side} ${side}">${rect}${parts}</svg>`;
}

export const logoDataUri = (o?: Parameters<typeof logoSvg>[0]) => `data:image/svg+xml;base64,${Buffer.from(logoSvg(o)).toString("base64")}`;
