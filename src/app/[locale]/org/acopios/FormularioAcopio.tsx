'use client'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { accionCrearAcopio, type EstadoAcopioForm } from './acciones'
import Campo from '@/componentes/formularios/Campo'
import SelectCatalogo, { type Opcion } from '@/componentes/formularios/SelectCatalogo'
import BotonEnviar from '@/componentes/formularios/BotonEnviar'

const inicial: EstadoAcopioForm = { enviado: false }

export default function FormularioAcopio({ municipios }: { municipios: Opcion[] }) {
  const t = useTranslations()
  const [estado, accion] = useActionState(accionCrearAcopio, inicial)
  const e = estado.errores ?? {}
  return (
    <details className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
      <summary className="cursor-pointer font-bold">➕ {t('org.nuevoAcopio')}</summary>
      {estado.enviado ? (
        <p className="mt-3 rounded bg-green-100 p-3 text-sm text-green-900">{t('formulario.gracias')}</p>
      ) : (
        <form action={accion} className="mt-4 max-w-lg">
          <Campo etiqueta={t('campos.nombre')} htmlFor="anombre" requerido errores={e.nombre}>
            <input id="anombre" name="nombre" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </Campo>
          <Campo etiqueta="Dirección" htmlFor="adir" requerido errores={e.direccion}>
            <input id="adir" name="direccion" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </Campo>
          <Campo etiqueta={t('campos.municipio')} htmlFor="amuni" requerido errores={e.municipio_id}>
            <SelectCatalogo id="amuni" name="municipio_id" opciones={municipios} placeholder={t('formulario.elige')} requerido />
          </Campo>
          <Campo etiqueta={t('org.recibe')} htmlFor="arecibe" ayuda="Separadas por coma" errores={e.recibe}>
            <input id="arecibe" name="recibe" placeholder="agua, alimentos, cobijas" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </Campo>
          <Campo etiqueta={t('org.noNecesita')} htmlFor="anono" ayuda="Separadas por coma" errores={e.no_necesita}>
            <input id="anono" name="no_necesita" placeholder="ropa usada" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </Campo>
          <BotonEnviar texto={t('org.guardarAcopio')} textoEnviando={t('acciones.enviando')} />
        </form>
      )}
    </details>
  )
}
