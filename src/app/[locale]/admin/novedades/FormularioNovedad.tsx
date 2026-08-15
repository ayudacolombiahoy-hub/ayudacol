'use client'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { accionCrearNovedad, type EstadoNovedad } from './acciones'
import Campo from '@/componentes/formularios/Campo'
import BotonEnviar from '@/componentes/formularios/BotonEnviar'

const inicial: EstadoNovedad = { enviado: false }

export default function FormularioNovedad() {
  const t = useTranslations('novedades')
  const tf = useTranslations('formulario')
  const ta = useTranslations('acciones')
  const [estado, accion] = useActionState(accionCrearNovedad, inicial)
  const e = estado.errores ?? {}

  if (estado.enviado) {
    return <p className="mb-6 rounded-lg bg-green-100 p-4 font-semibold text-green-900">{tf('gracias')}</p>
  }

  return (
    <form action={accion} className="mb-8 max-w-lg">
      <Campo etiqueta={t('tituloEs')} htmlFor="titulo_es" requerido errores={e.titulo_es}>
        <input id="titulo_es" name="titulo_es" type="text" required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('tituloEn')} htmlFor="titulo_en" requerido errores={e.titulo_en}>
        <input id="titulo_en" name="titulo_en" type="text" required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('contenidoEs')} htmlFor="contenido_es" requerido errores={e.contenido_es}>
        <textarea id="contenido_es" name="contenido_es" rows={4} required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('contenidoEn')} htmlFor="contenido_en" requerido errores={e.contenido_en}>
        <textarea id="contenido_en" name="contenido_en" rows={4} required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      {e._ && <p className="mb-3 text-sm text-red-600">{tf('error')}</p>}
      <BotonEnviar texto={t('guardar')} textoEnviando={ta('enviando')} />
    </form>
  )
}
