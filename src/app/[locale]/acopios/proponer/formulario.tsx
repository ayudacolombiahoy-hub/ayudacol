'use client'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { accionProponerAcopio, type EstadoFormulario } from './acciones'
import Campo from '@/componentes/formularios/Campo'
import SelectCatalogo, { type Opcion } from '@/componentes/formularios/SelectCatalogo'
import Honeypot from '@/componentes/formularios/Honeypot'
import BotonEnviar from '@/componentes/formularios/BotonEnviar'

const inicial: EstadoFormulario = { enviado: false }

export default function FormularioProponerAcopio({ municipios }: { municipios: Opcion[] }) {
  const t = useTranslations()
  const [estado, accion] = useActionState(accionProponerAcopio, inicial)

  if (estado.enviado) {
    return <p className="rounded-lg bg-green-100 p-4 font-semibold text-green-900">{t('acopiosPublico.gracias')}</p>
  }

  const e = estado.errores ?? {}
  return (
    <form action={accion} className="max-w-lg">
      <Honeypot />
      <Campo etiqueta={t('acopiosPublico.nombreCentro')} htmlFor="nombre" requerido errores={e.nombre}>
        <input id="nombre" name="nombre" type="text" required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('campos.direccion')} htmlFor="direccion" requerido errores={e.direccion}>
        <input id="direccion" name="direccion" type="text" required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('campos.municipio')} htmlFor="municipio_id" requerido errores={e.municipio_id}>
        <SelectCatalogo id="municipio_id" name="municipio_id" opciones={municipios} placeholder={t('formulario.elige')} requerido />
      </Campo>
      <Campo etiqueta={t('acopiosPublico.horarios')} htmlFor="horarios" errores={e.horarios}>
        <input id="horarios" name="horarios" type="text"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('acopiosPublico.contacto')} htmlFor="contacto_publico" requerido errores={e.contacto_publico}>
        <input id="contacto_publico" name="contacto_publico" type="text" required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('org.recibe')} htmlFor="recibe" ayuda="Separadas por coma" errores={e.recibe}>
        <input id="recibe" name="recibe" placeholder="agua, alimentos, cobijas"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('org.noNecesita')} htmlFor="no_necesita" ayuda="Separadas por coma" errores={e.no_necesita}>
        <input id="no_necesita" name="no_necesita" placeholder="ropa usada"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      {e._ && <p className="mb-3 text-sm text-red-600">{t('formulario.error')}</p>}
      <BotonEnviar texto={t('acciones.enviar')} textoEnviando={t('acciones.enviando')} />
    </form>
  )
}
