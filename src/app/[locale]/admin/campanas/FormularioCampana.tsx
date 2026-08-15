'use client'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { accionCrearCampana, type EstadoCampana } from './acciones'
import Campo from '@/componentes/formularios/Campo'
import BotonEnviar from '@/componentes/formularios/BotonEnviar'

const inicial: EstadoCampana = { enviado: false }

export default function FormularioCampana() {
  const t = useTranslations('donar')
  const tf = useTranslations('formulario')
  const ta = useTranslations('acciones')
  const [estado, accion] = useActionState(accionCrearCampana, inicial)
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
      <Campo etiqueta={t('descEs')} htmlFor="descripcion_es" requerido errores={e.descripcion_es}>
        <textarea id="descripcion_es" name="descripcion_es" rows={3} required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('descEn')} htmlFor="descripcion_en" requerido errores={e.descripcion_en}>
        <textarea id="descripcion_en" name="descripcion_en" rows={3} required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('campoOrg')} htmlFor="organizacion" requerido errores={e.organizacion}>
        <input id="organizacion" name="organizacion" type="text" required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('campoUrl')} htmlFor="url" requerido errores={e.url}>
        <input id="url" name="url" type="url" required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      {e._ && <p className="mb-3 text-sm text-red-600">{tf('error')}</p>}
      <BotonEnviar texto={t('guardar')} textoEnviando={ta('enviando')} />
    </form>
  )
}
