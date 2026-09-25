"use client";

import { useState } from "react";
import { btnSecondary, inputCls } from "@/components/admin/ui";

type Piece = { type: string; label: string; quantity: number; dimensions?: string; weight?: string; composition?: string };

export function PiecesEditor({ initial }: { initial: Piece[] }) {
  const [rows, setRows] = useState<Piece[]>(initial.length ? initial : [{ type: "banho", label: "Toalha de banho", quantity: 1 }]);
  const set = (i: number, k: keyof Piece, v: string) => setRows((r) => r.map((row, j) => (j === i ? { ...row, [k]: k === "quantity" ? Number(v) || 0 : v } : row)));
  return (
    <div className="space-y-2">
      <input type="hidden" name="pieces" value={JSON.stringify(rows)} />
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-2 md:grid-cols-[110px_1fr_70px_1fr_1fr_1.4fr_auto]">
          <select value={r.type} onChange={(e) => set(i, "type", e.target.value)} className={inputCls} aria-label="Tipo">
            <option value="banho">Banho</option>
            <option value="rosto">Rosto</option>
            <option value="piso">Piso</option>
            <option value="outro">Outro</option>
          </select>
          <input value={r.label} onChange={(e) => set(i, "label", e.target.value)} placeholder="Nome da peça" className={inputCls} aria-label="Nome" />
          <input type="number" min={1} value={r.quantity} onChange={(e) => set(i, "quantity", e.target.value)} className={inputCls} aria-label="Quantidade" />
          <input value={r.dimensions ?? ""} onChange={(e) => set(i, "dimensions", e.target.value)} placeholder="90 × 150 cm" className={inputCls} aria-label="Medidas" />
          <input value={r.weight ?? ""} onChange={(e) => set(i, "weight", e.target.value)} placeholder="600 g/m²" className={inputCls} aria-label="Gramatura" />
          <input value={r.composition ?? ""} onChange={(e) => set(i, "composition", e.target.value)} placeholder="Composição" className={inputCls} aria-label="Composição" />
          <button type="button" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} className="h-10 rounded-lg px-2 text-sm text-red-600 hover:bg-red-50" aria-label="Remover peça">
            Remover
          </button>
        </div>
      ))}
      <button type="button" className={btnSecondary} onClick={() => setRows((r) => [...r, { type: "outro", label: "", quantity: 1 }])}>
        Adicionar peça
      </button>
    </div>
  );
}

export function SpecsEditor({ initial }: { initial: { label: string; value: string }[] }) {
  const [rows, setRows] = useState(initial);
  return (
    <div className="space-y-2">
      <input type="hidden" name="specs" value={JSON.stringify(rows)} />
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_1.5fr_auto] gap-2">
          <input value={r.label} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} placeholder="Rótulo" className={inputCls} aria-label="Rótulo" />
          <input value={r.value} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, value: e.target.value } : y)))} placeholder="Valor" className={inputCls} aria-label="Valor" />
          <button type="button" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} className="h-10 rounded-lg px-2 text-sm text-red-600 hover:bg-red-50">
            Remover
          </button>
        </div>
      ))}
      <button type="button" className={btnSecondary} onClick={() => setRows((r) => [...r, { label: "", value: "" }])}>
        Adicionar especificação
      </button>
    </div>
  );
}
