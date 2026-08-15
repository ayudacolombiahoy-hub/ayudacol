'use client'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { accionCrearRefugio, type EstadoRefugioForm } from './acciones'
import Campo from '@/componentes/formularios/Campo'
import SelectCatalogo, { type Opcion } from '@/componentes/formularios/SelectCatalogo'
import BotonEnviar from '@/componentes/formularios/BotonEnviar'

const inicial: EstadoRefugioForm = { enviado: false }

export default function FormularioRefugio({ municipios }: { municipios: Opcion[] }) {
  const t = useTranslations()
  const [estado, accion] = useActionState(accionCrearRefugio, inicial)
  const e = estado.errores ?? {}
  return (
    <details className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
      <summary className="cursor-pointer font-bold">➕ {t('refugios.nuevoRefugio')}</summary>
      {estado.enviado ? (
        <p className="mt-3 rounded bg-green-100 p-3 text-sm text-green-900">{t('formulario.gracias')}</p>
      ) : (
        <form action={accion} className="mt-4 max-w-lg">
          <Campo etiqueta={t('campos.nombre')} htmlFor="refnombre" requerido errores={e.nombre}>
            <input id="refnombre" name="nombre" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </Campo>
          <Campo etiqueta={t('campos.municipio')} htmlFor="refmuni" requerido errores={e.municipio_id}>
            <SelectCatalogo id="refmuni" name="municipio_id" opciones={municipios} placeholder={t('formulario.elige')} requerido />
          </Campo>
          <Campo etiqueta={t('campos.direccion')} htmlFor="refdir" requerido errores={e.direccion}>
            <input id="refdir" name="direccion" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </Campo>
          <Campo etiqueta={t('refugios.campoEspecies')} htmlFor="refesp" ayuda={t('campos.opcional')} errores={e.especies}>
            <input id="refesp" name="especies" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </Campo>
          <Campo etiqueta={t('refugios.capacidad')} htmlFor="refcap" ayuda={t('campos.opcional')} errores={e.capacidad}>
            <input id="refcap" name="capacidad" type="number" min={0} step={1} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </Campo>
          <Campo etiqueta={t('campos.contactoPublico')} htmlFor="refcontacto" ayuda={t('campos.opcional')} errores={e.contacto_publico}>
            <input id="refcontacto" name="contacto_publico" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </Campo>
          {e._ && <p className="mb-3 text-sm text-red-600">{t('formulario.error')}</p>}
          <BotonEnviar texto={t('refugios.guardar')} textoEnviando={t('acciones.enviando')} />
        </form>
      )}
    </details>
  )
}
