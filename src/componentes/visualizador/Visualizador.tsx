'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navegacion'
import { PATHS_COLOMBIA } from './colombia-paths'
import type { ResumenDepto } from '@/lib/datos/agregados'

// Focos calibrados (spec §7), viewBox "245 30 400 555".
const FOCOS: { depto: string; x: number; y: number; critico: boolean; etiqueta: string }[] = [
  { depto: 'Chocó', x: 328.3, y: 271.9, critico: true, etiqueta: 'Chocó' },
  { depto: 'Caldas', x: 362.8, y: 290.5, critico: true, etiqueta: 'Manizales' },
  { depto: 'Risaralda', x: 357.6, y: 298.4, critico: false, etiqueta: 'Pereira' },
  { depto: 'Quindío', x: 357.9, y: 306.8, critico: false, etiqueta: 'Armenia' },
  { depto: 'Valle del Cauca', x: 332.2, y: 339.2, critico: false, etiqueta: 'Cali' },
]

const VACIO: ResumenDepto = { departamento: '', activas: 0, urgentes: 0, resueltas: 0, acopios: 0 }

export default function Visualizador({ resumen }: { resumen: ResumenDepto[] }) {
  const t = useTranslations('viz')
  const porDepto = new Map(resumen.map((r) => [r.departamento, r]))
  const [sel, setSel] = useState<string>('Caldas')
  const datos = porDepto.get(sel) ?? { ...VACIO, departamento: sel }

  return (
    <div className="flex flex-wrap overflow-hidden rounded-xl border border-slate-800 bg-[#020617]">
      <div className="relative min-w-[300px] flex-[1.2] p-2">
        <div className="absolute left-4 top-3 z-10">
          <div className="text-[10px] font-semibold text-green-400">● {t('enVivo')}</div>
        </div>
        <svg viewBox="245 30 400 555" className="block h-auto w-full">
          {PATHS_COLOMBIA.map((p, i) => (
            <path key={i} d={p.d}
              fill={p.afectado ? '#123a63' : '#0a2440'}
              stroke={p.afectado ? '#3b82c4' : '#1b4a73'} strokeWidth={p.afectado ? 0.9 : 0.6} />
          ))}
          {FOCOS.map((f) => {
            const activo = sel === f.depto
            const color = f.critico ? '#ef4444' : '#f59e0b'
            return (
              <g key={f.depto} onClick={() => setSel(f.depto)} className="cursor-pointer">
                <circle cx={f.x} cy={f.y} r={12} fill={color} opacity={0.25}>
                  <animate attributeName="r" from="6" to="20" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.5" to="0" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx={f.x} cy={f.y} r={activo ? 8 : 6} fill={color} stroke="#020617" strokeWidth={1} />
                <text x={f.x + 9} y={f.y + 3} fontSize="9.5" fontWeight="700"
                  fill={f.critico ? '#fca5a5' : '#fcd34d'}>{f.etiqueta}</text>
              </g>
            )
          })}
        </svg>
        <div className="px-3 pb-1 text-right text-[9px] text-slate-500">{t('mapaCredito')}: © Vemaps.com</div>
      </div>
      <div className="min-w-[260px] flex-1 border-l border-slate-800 bg-[#0b1220] p-6 text-slate-200">
        <div className="text-lg font-bold text-sky-300">{datos.departamento}</div>
        <div className="mt-2 text-5xl font-extrabold tabular-nums">{datos.activas}</div>
        <div className="text-xs text-slate-400">{t('activas')}</div>
        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between border-b border-slate-800 pb-1"><dt>🔴 {t('urgentes')}</dt><dd className="font-bold text-red-400 tabular-nums">{datos.urgentes}</dd></div>
          <div className="flex justify-between border-b border-slate-800 pb-1"><dt>📦 {t('acopios')}</dt><dd className="font-bold text-green-400 tabular-nums">{datos.acopios}</dd></div>
          <div className="flex justify-between border-b border-slate-800 pb-1"><dt>✅ {t('resueltas')}</dt><dd className="font-bold text-lime-400 tabular-nums">{datos.resueltas}</dd></div>
        </dl>
        <Link href="/mapa" className="mt-5 inline-block rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">{t('verDetalle')} →</Link>
      </div>
    </div>
  )
}
