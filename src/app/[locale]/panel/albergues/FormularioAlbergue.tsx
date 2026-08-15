'use client'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { accionCrearAlbergue, type EstadoAlbergueForm } from './acciones'
import Campo from '@/componentes/formularios/Campo'
import SelectCatalogo, { type Opcion } from '@/componentes/formularios/SelectCatalogo'
import BotonEnviar from '@/componentes/formularios/BotonEnviar'

const inicial: EstadoAlbergueForm = { enviado: false }

export default function FormularioAlbergue({ municipios }: { municipios: Opcion[] }) {
  const t = useTranslations()
  const [estado, accion] = useActionState(accionCrearAlbergue, inicial)
  const e = estado.errores ?? {}
  return (
    <details className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
      <summary className="cursor-pointer font-bold">➕ {t('albergues.nuevoAlbergue')}</summary>
      {estado.enviado ? (
        <p className="mt-3 rounded bg-green-100 p-3 text-sm text-green-900">{t('formulario.gracias')}</p>
      ) : (
        <form action={accion} className="mt-4 max-w-lg">
          <Campo etiqueta={t('campos.nombre')} htmlFor="albnombre" requerido errores={e.nombre}>
            <input id="albnombre" name="nombre" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </Campo>
          <Campo etiqueta={t('campos.municipio')} htmlFor="albmuni" requerido errores={e.municipio_id}>
            <SelectCatalogo id="albmuni" name="municipio_id" opciones={municipios} placeholder={t('formulario.elige')} requerido />
          </Campo>
          <Campo etiqueta={t('campos.direccion')} htmlFor="albdir" requerido errores={e.direccion}>
            <input id="albdir" name="direccion" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </Campo>
          <Campo etiqueta={t('albergues.capacidad')} htmlFor="albcap" ayuda={t('campos.opcional')} errores={e.capacidad}>
            <input id="albcap" name="capacidad" type="number" min={0} step={1} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </Campo>
          <Campo etiqueta={t('campos.contactoPublico')} htmlFor="albcontacto" ayuda={t('campos.opcional')} errores={e.contacto_publico}>
            <input id="albcontacto" name="contacto_publico" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </Campo>
          {e._ && <p className="mb-3 text-sm text-red-600">{t('formulario.error')}</p>}
          <BotonEnviar texto={t('albergues.guardar')} textoEnviando={t('acciones.enviando')} />
        </form>
      )}
    </details>
  )
}
