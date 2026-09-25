import { shade, isLight } from "@/utils/color";

/**
 * Ilustração vetorial de uma pilha de toalhas dobradas, na(s) cor(es) escolhida(s).
 * Usada como visual padrão enquanto o admin não cadastra fotografias reais —
 * leve (SVG inline, zero requisições) e sempre fiel à cor selecionada.
 */
type Piece = "banho" | "rosto" | "piso";

type Props = {
  colors: string | string[];
  pieces?: Piece[];
  className?: string;
  label?: string;
  showTag?: boolean;
};

const DIMS: Record<Piece, { w: number; h: number }> = {
  piso: { w: 300, h: 34 },
  banho: { w: 280, h: 58 },
  rosto: { w: 220, h: 44 },
};

export function TowelStack({ colors, pieces = ["piso", "banho", "banho", "rosto", "rosto"], className, label = "Pilha de toalhas MONTEZ", showTag = true }: Props) {
  const palette = Array.isArray(colors) ? colors : [colors];
  const W = 360;
  let y = 0;
  const layers = pieces.map((p, i) => {
    const d = DIMS[p];
    const layer = { p, ...d, x: (W - d.w) / 2 + (i % 2 === 0 ? -4 : 5), y, color: palette[i % palette.length] };
    y += d.h - 3;
    return layer;
  });
  const totalH = y + 10;
  const H = totalH + 30;
  // Empilhamos de baixo para cima: invertemos o eixo y
  const uid = Math.abs(palette.join("").split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)).toString(36);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label={label}>
      <defs>
        <pattern id={`terry-${uid}`} width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="0.9" fill="#000" opacity="0.07" />
          <circle cx="4.5" cy="4.5" r="0.9" fill="#fff" opacity="0.10" />
        </pattern>
        <linearGradient id={`shine-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.16" />
        </linearGradient>
        <radialGradient id={`shadow-${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#2E2B28" stopOpacity="0.28" />
          <stop offset="1" stopColor="#2E2B28" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx={W / 2} cy={H - 16} rx={170} ry={14} fill={`url(#shadow-${uid})`} />
      {layers.map((l, i) => {
        const top = H - 22 - l.y - l.h;
        const edge = shade(l.color, -0.22);
        const band = isLight(l.color) ? shade(l.color, -0.1) : shade(l.color, 0.12);
        const r = l.p === "piso" ? 6 : 14;
        const isTop = i === layers.length - 1;
        return (
          <g key={i}>
            <rect x={l.x} y={top} width={l.w} height={l.h} rx={r} fill={l.color} />
            <rect x={l.x} y={top} width={l.w} height={l.h} rx={r} fill={`url(#terry-${uid})`} />
            {/* barra tecida (dobby) característica de toalha de hotel */}
            {l.p !== "piso" && <rect x={l.x + l.w * 0.72} y={top + 2} width={l.w * 0.09} height={l.h - 4} fill={band} opacity="0.9" />}
            {l.p !== "piso" && <rect x={l.x + l.w * 0.72 + 3} y={top + 2} width={1.2} height={l.h - 4} fill={edge} opacity="0.35" />}
            {l.p === "piso" && <rect x={l.x + 8} y={top + l.h / 2 - 1} width={l.w - 16} height={2} fill={band} opacity="0.8" />}
            {/* dobra frontal */}
            <path d={`M${l.x + r} ${top + l.h - 1} H${l.x + l.w - r}`} stroke={edge} strokeWidth="2" opacity="0.55" />
            <rect x={l.x} y={top} width={l.w} height={l.h} rx={r} fill={`url(#shine-${uid})`} />
            {isTop && showTag && l.p !== "piso" && (
              <g>
                <rect x={l.x + 18} y={top + l.h - 16} width={46} height={13} rx={1.5} fill="#F7F3EC" stroke={shade("#F7F3EC", -0.15)} strokeWidth="0.6" />
                <text x={l.x + 41} y={top + l.h - 7} textAnchor="middle" fontSize="6.4" letterSpacing="1.6" fill="#2E2B28" fontFamily="Georgia, serif">
                  MONTEZ
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function piecesForKit(counts: { banho?: number; rosto?: number; piso?: number }): Piece[] {
  const list: Piece[] = [];
  for (let i = 0; i < (counts.piso ?? 0); i++) list.push("piso");
  for (let i = 0; i < (counts.banho ?? 0); i++) list.push("banho");
  for (let i = 0; i < (counts.rosto ?? 0); i++) list.push("rosto");
  return list.length ? list : ["banho", "banho", "rosto", "rosto"];
}
