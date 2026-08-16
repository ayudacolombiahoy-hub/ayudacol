'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Opcion } from '@/componentes/formularios/SelectCatalogo'
import { CATEGORIAS, URGENCIAS } from '@/lib/validacion/esquemas'
import type { Borrador } from '@/lib/ia/borrador'
import { accionExtraerCapturas, accionGuardarLote, type ResumenGuardado } from './acciones'

type Fila = Borrador & { incluir: boolean }

export default function CargadorCapturas({ municipios }: { municipios: Opcion[] }) {
  const t = useTranslations()
  const [archivos, setArchivos] = useState<File[]>([])
  const [filas, setFilas] = useState<Fila[]>([])
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [resumen, setResumen] = useState<ResumenGuardado | null>(null)

  const cats: Opcion[] = CATEGORIAS.map((c) => ({ valor: c, texto: t(`categorias.${c}`) }))
  const urgs: Opcion[] = URGENCIAS.map((u) => ({ valor: u, texto: t(`urgencias.${u}`) }))

  async function extraer() {
    if (archivos.length === 0) return
    setCargando(true); setAviso(null); setResumen(null)
    try {
      const fd = new FormData()
      for (const a of archivos) fd.append('capturas', a)
      const r = await accionExtraerCapturas(fd)
      if (!r.ok) { setAviso(t(`capturas.error.${r.motivo}`)); return }
      setFilas(r.borradores.map((b) => ({ ...b, incluir: true })))
      if (r.borradores.length === 0) setAviso(t('capturas.sinResultados'))
    } catch {
      setAviso(t('capturas.error.error_ia'))
    } finally {
      setCargando(false)
    }
  }

  function editar(i: number, campo: keyof Borrador, valor: string | boolean) {
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

  const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm'

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
          {t('capturas.resumen', { insertadas: resumen.insertadas, duplicadas: resumen.duplicadas, errores: resumen.errores })}
        </p>
      )}

      {filas.length > 0 && (
        <div className="mt-4 grid gap-4">
          {filas.map((f, i) => (
            <div key={i} className={`rounded-lg border p-3 ${f.incluir ? 'border-gray-300' : 'border-gray-200 opacity-50'}`}>
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={f.incluir} onChange={(e) => editar(i, 'incluir' as keyof Borrador, e.target.checked)} />
                {t('capturas.incluir')}
                {f.banderas.includes('municipio_sin_mapear') && <span className="ml-auto text-xs font-bold text-red-600">⚠️ {t('capturas.municipioSinMapear')}</span>}
                {f.banderas.includes('categoria_incierta') && <span className="text-xs font-bold text-amber-600">⚠️ {t('capturas.confianzaBaja')}</span>}
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <select value={f.categoria} onChange={(e) => editar(i, 'categoria', e.target.value)} className={inputCls}>
                  {cats.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
                </select>
                <select value={f.urgencia} onChange={(e) => editar(i, 'urgencia', e.target.value)} className={inputCls}>
                  {urgs.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
                </select>
                <select
                  value={f.municipio_id} onChange={(e) => editar(i, 'municipio_id', e.target.value)}
                  className={`${inputCls} sm:col-span-2 ${f.municipio_id ? '' : 'border-red-400'}`}
                >
                  <option value="">{t('formulario.elige')}</option>
                  {municipios.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
                </select>
                <textarea value={f.descripcion} onChange={(e) => editar(i, 'descripcion', e.target.value)} rows={2} className={`${inputCls} sm:col-span-2`} />
                <input value={f.detalle_ubicacion} onChange={(e) => editar(i, 'detalle_ubicacion', e.target.value)} placeholder={t('campos.detalleUbicacion')} className={`${inputCls} sm:col-span-2`} />
                <input value={f.contacto_nombre} onChange={(e) => editar(i, 'contacto_nombre', e.target.value)} placeholder={t('campos.contactoNombre')} className={inputCls} />
                <input value={f.contacto_telefono} onChange={(e) => editar(i, 'contacto_telefono', e.target.value)} placeholder={t('campos.contactoTelefono')} className={inputCls} />
              </div>
            </div>
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
