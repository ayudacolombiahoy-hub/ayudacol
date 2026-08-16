'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Opcion } from '@/componentes/formularios/SelectCatalogo'
import { CATEGORIAS, URGENCIAS, ESPECIES_MASCOTA, TIPOS_REPORTE_MASCOTA } from '@/lib/validacion/esquemas'
import type { Bandera, Borrador } from '@/lib/ia/borrador'
import { accionExtraerCapturas, accionGuardarLote, type ResumenGuardado } from './acciones'

type Fila = Borrador & { incluir: boolean }
type Editar = (i: number, campo: keyof Borrador, valor: string | number | boolean | null) => void

const TIPOS_ENTIDAD = ['necesidad', 'mascota', 'desaparecido', 'acopio', 'albergue'] as const
const BANDERAS_ROJAS = new Set<Bandera>(['municipio_sin_mapear'])
const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm'

function TarjetaBorrador({ f, i, editar, municipios }: { f: Fila; i: number; editar: Editar; municipios: Opcion[] }) {
  const t = useTranslations()
  const cats: Opcion[] = CATEGORIAS.map((c) => ({ valor: c, texto: t(`categorias.${c}`) }))
  const urgs: Opcion[] = URGENCIAS.map((u) => ({ valor: u, texto: t(`urgencias.${u}`) }))
  const especies: Opcion[] = ESPECIES_MASCOTA.map((e) => ({ valor: e, texto: t(`capturas.especie.${e}`) }))
  const tiposReporte: Opcion[] = TIPOS_REPORTE_MASCOTA.map((v) => ({ valor: v, texto: t(`capturas.tipoReporte.${v}`) }))

  const municipioSelect = (
    <select
      value={f.municipio_id} onChange={(e) => editar(i, 'municipio_id', e.target.value)}
      className={`${inputCls} sm:col-span-2 ${f.municipio_id ? '' : 'border-red-400'}`}
    >
      <option value="">{t('formulario.elige')}</option>
      {municipios.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
    </select>
  )

  return (
    <div className={`rounded-lg border p-3 ${f.incluir ? 'border-gray-300' : 'border-gray-200 opacity-50'}`}>
      <label className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={f.incluir} onChange={(e) => editar(i, 'incluir' as keyof Borrador, e.target.checked)} />
        {t('capturas.incluir')}
        <span className="ml-auto flex flex-wrap gap-2">
          {f.banderas.map((b) => (
            <span key={b} className={`text-xs font-bold ${BANDERAS_ROJAS.has(b) ? 'text-red-600' : 'text-amber-600'}`}>
              ⚠️ {t(`capturas.banderas.${b}`)}
            </span>
          ))}
        </span>
      </label>

      <select value={f.tipo} onChange={(e) => editar(i, 'tipo', e.target.value)} className={`${inputCls} mb-2`}>
        {TIPOS_ENTIDAD.map((tp) => <option key={tp} value={tp}>{t(`capturas.tipos.${tp}`)}</option>)}
      </select>

      <div className="grid gap-2 sm:grid-cols-2">
        {f.tipo === 'necesidad' && (
          <>
            <select value={f.categoria} onChange={(e) => editar(i, 'categoria', e.target.value)} className={inputCls}>
              {cats.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
            </select>
            <select value={f.urgencia} onChange={(e) => editar(i, 'urgencia', e.target.value)} className={inputCls}>
              {urgs.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
            </select>
            {municipioSelect}
            <textarea value={f.descripcion} onChange={(e) => editar(i, 'descripcion', e.target.value)} rows={2} className={`${inputCls} sm:col-span-2`} />
            <input value={f.detalle_ubicacion} onChange={(e) => editar(i, 'detalle_ubicacion', e.target.value)} placeholder={t('campos.detalleUbicacion')} className={`${inputCls} sm:col-span-2`} />
            <input value={f.contacto_nombre} onChange={(e) => editar(i, 'contacto_nombre', e.target.value)} placeholder={t('campos.contactoNombre')} className={inputCls} />
            <input value={f.contacto_telefono} onChange={(e) => editar(i, 'contacto_telefono', e.target.value)} placeholder={t('campos.contactoTelefono')} className={inputCls} />
          </>
        )}

        {f.tipo === 'mascota' && (
          <>
            <select value={f.tipo_reporte} onChange={(e) => editar(i, 'tipo_reporte', e.target.value)} className={inputCls}>
              {tiposReporte.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
            </select>
            <select value={f.especie} onChange={(e) => editar(i, 'especie', e.target.value)} className={inputCls}>
              {especies.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
            </select>
            <input value={f.nombre} onChange={(e) => editar(i, 'nombre', e.target.value)} placeholder={t('capturas.nombre')} className={`${inputCls} sm:col-span-2`} />
            {municipioSelect}
            <textarea value={f.descripcion} onChange={(e) => editar(i, 'descripcion', e.target.value)} rows={2} className={`${inputCls} sm:col-span-2`} />
            <input value={f.detalle_ubicacion} onChange={(e) => editar(i, 'detalle_ubicacion', e.target.value)} placeholder={t('campos.detalleUbicacion')} className={`${inputCls} sm:col-span-2`} />
            <input value={f.contacto_nombre} onChange={(e) => editar(i, 'contacto_nombre', e.target.value)} placeholder={t('campos.contactoNombre')} className={inputCls} />
            <input value={f.contacto_telefono} onChange={(e) => editar(i, 'contacto_telefono', e.target.value)} placeholder={t('campos.contactoTelefono')} className={inputCls} />
          </>
        )}

        {f.tipo === 'desaparecido' && (
          <>
            <input value={f.nombre} onChange={(e) => editar(i, 'nombre', e.target.value)} placeholder={t('capturas.nombre')} className={inputCls} />
            <input
              type="number" value={f.edad ?? ''}
              onChange={(e) => editar(i, 'edad', e.target.value === '' ? null : Number(e.target.value))}
              placeholder={t('capturas.edad')} className={inputCls}
            />
            {municipioSelect}
            <textarea value={f.descripcion} onChange={(e) => editar(i, 'descripcion', e.target.value)} rows={2} className={`${inputCls} sm:col-span-2`} />
            <input value={f.detalle_ubicacion} onChange={(e) => editar(i, 'detalle_ubicacion', e.target.value)} placeholder={t('campos.detalleUbicacion')} className={`${inputCls} sm:col-span-2`} />
            <input value={f.contacto_nombre} onChange={(e) => editar(i, 'contacto_nombre', e.target.value)} placeholder={t('campos.contactoNombre')} className={inputCls} />
            <input value={f.contacto_telefono} onChange={(e) => editar(i, 'contacto_telefono', e.target.value)} placeholder={t('campos.contactoTelefono')} className={inputCls} />
          </>
        )}

        {f.tipo === 'acopio' && (
          <>
            <input value={f.nombre} onChange={(e) => editar(i, 'nombre', e.target.value)} placeholder={t('capturas.nombre')} className={inputCls} />
            <input value={f.direccion} onChange={(e) => editar(i, 'direccion', e.target.value)} placeholder={t('capturas.direccion')} className={inputCls} />
            {municipioSelect}
            <input value={f.recibe} onChange={(e) => editar(i, 'recibe', e.target.value)} placeholder={t('capturas.recibe')} className={inputCls} />
            <input value={f.no_necesita} onChange={(e) => editar(i, 'no_necesita', e.target.value)} placeholder={t('capturas.noNecesita')} className={inputCls} />
            <input value={f.horarios} onChange={(e) => editar(i, 'horarios', e.target.value)} placeholder={t('capturas.horarios')} className={inputCls} />
            <input value={f.contacto_publico} onChange={(e) => editar(i, 'contacto_publico', e.target.value)} placeholder={t('capturas.contactoPublico')} className={inputCls} />
          </>
        )}

        {f.tipo === 'albergue' && (
          <>
            <input value={f.nombre} onChange={(e) => editar(i, 'nombre', e.target.value)} placeholder={t('capturas.nombre')} className={inputCls} />
            <input value={f.direccion} onChange={(e) => editar(i, 'direccion', e.target.value)} placeholder={t('capturas.direccion')} className={inputCls} />
            {municipioSelect}
            <input
              type="number" value={f.capacidad ?? ''}
              onChange={(e) => editar(i, 'capacidad', e.target.value === '' ? null : Number(e.target.value))}
              placeholder={t('capturas.capacidad')} className={inputCls}
            />
            <input value={f.contacto_publico} onChange={(e) => editar(i, 'contacto_publico', e.target.value)} placeholder={t('capturas.contactoPublico')} className={inputCls} />
          </>
        )}
      </div>
    </div>
  )
}

export default function CargadorCapturas({ municipios }: { municipios: Opcion[] }) {
  const t = useTranslations()
  const [archivos, setArchivos] = useState<File[]>([])
  const [filas, setFilas] = useState<Fila[]>([])
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [resumen, setResumen] = useState<ResumenGuardado | null>(null)

  async function extraer() {
    if (archivos.length === 0) return
    setCargando(true); setAviso(null); setResumen(null)
    try {
      const fd = new FormData()
      for (const a of archivos) fd.append('capturas', a)
      const r = await accionExtraerCapturas(fd)
      if (!r.ok) { setAviso(t(`capturas.error.${r.motivo}`)); return }
      setFilas(r.borradores.map((b) => ({ ...b, incluir: true })))
      if (r.borradores.length === 0) {
        const base = r.fallidas > 0 ? t('capturas.noSeLeyeron', { n: r.fallidas }) : t('capturas.sinResultados')
        setAviso(r.error ? `${base} — ${r.error}` : base)
      }
    } catch {
      setAviso(t('capturas.error.error_ia'))
    } finally {
      setCargando(false)
    }
  }

  const editar: Editar = (i, campo, valor) => {
    setFilas((prev) => prev.map((f, j) => (j === i ? { ...f, [campo]: valor } : f)))
  }

  async function guardar() {
    const incluidas = filas.filter((f) => f.incluir)
    if (incluidas.length === 0) return
    setGuardando(true); setAviso(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const r = await accionGuardarLote(incluidas.map(({ incluir, ...b }) => b))
      if (!r.ok) { setAviso(t(`capturas.error.${r.motivo}`)); return }
      setResumen(r.resumen)
      setFilas([]); setArchivos([])
    } catch {
      setAviso(t('capturas.error.error_ia'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="mb-2 font-bold">🖼️ {t('capturas.titulo')}</h2>
      <p className="mb-3 text-sm text-gray-500">{t('capturas.ayuda')}</p>

      <input
        type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple
        onChange={(e) => setArchivos(Array.from(e.target.files ?? []))}
        className="mb-3 block text-sm"
      />
      <button
        onClick={extraer} disabled={cargando || archivos.length === 0}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
      >
        {cargando ? t('capturas.extrayendo') : t('capturas.extraer')}
      </button>

      {aviso && <p className="mt-3 rounded bg-yellow-100 p-3 text-sm text-yellow-900">{aviso}</p>}
      {resumen && (
        <p className="mt-3 rounded bg-green-100 p-3 text-sm text-green-900">
          {t('capturas.resumen', { insertadas: resumen.insertadas, actualizadas: resumen.actualizadas, duplicadas: resumen.duplicadas, errores: resumen.errores })}
        </p>
      )}

      {filas.length > 0 && (
        <div className="mt-4 grid gap-4">
          {filas.map((f, i) => (
            <TarjetaBorrador key={i} f={f} i={i} editar={editar} municipios={municipios} />
          ))}
          <button
            onClick={guardar} disabled={guardando}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {guardando ? t('capturas.guardando') : t('capturas.guardar')}
          </button>
        </div>
      )}
    </section>
  )
}
