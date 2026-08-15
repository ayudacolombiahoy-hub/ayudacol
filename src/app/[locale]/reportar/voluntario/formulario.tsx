'use client'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { accionReportarVoluntario, type EstadoFormulario } from './acciones'
import Campo from '@/componentes/formularios/Campo'
import SelectCatalogo, { type Opcion } from '@/componentes/formularios/SelectCatalogo'
import Honeypot from '@/componentes/formularios/Honeypot'
import BotonEnviar from '@/componentes/formularios/BotonEnviar'
import { HABILIDADES } from '@/lib/validacion/esquemas'

const inicial: EstadoFormulario = { enviado: false }

export default function FormularioVoluntario({ municipios }: { municipios: Opcion[] }) {
  const t = useTranslations()
  const [estado, accion] = useActionState(accionReportarVoluntario, inicial)
  if (estado.enviado) {
    return <p className="rounded-lg bg-green-100 p-4 font-semibold text-green-900">{t('formulario.gracias')}</p>
  }
  const e = estado.errores ?? {}
  return (
    <form action={accion} className="max-w-lg">
      <Honeypot />
      <Campo etiqueta={t('campos.nombre')} htmlFor="nombre" requerido errores={e.nombre}>
        <input id="nombre" name="nombre" type="text" required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('campos.habilidades')} htmlFor="habilidades" requerido errores={e.habilidades}>
        <div className="grid grid-cols-2 gap-2">
          {HABILIDADES.map((h) => (
            <label key={h} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="habilidades" value={h} /> {t(`habilidades.${h}`)}
            </label>
          ))}
        </div>
      </Campo>
      <Campo etiqueta={t('campos.disponibilidad')} htmlFor="disponibilidad" errores={e.disponibilidad}>
        <input id="disponibilidad" name="disponibilidad" type="text"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('campos.municipio')} htmlFor="municipio_id" requerido errores={e.municipio_id}>
        <SelectCatalogo id="municipio_id" name="municipio_id" opciones={municipios} placeholder={t('formulario.elige')} requerido />
      </Campo>
      <Campo etiqueta={t('campos.contactoTelefono')} htmlFor="contacto_telefono" requerido
        ayuda={t('campos.telefonoPrivado')} errores={e.contacto_telefono}>
        <input id="contacto_telefono" name="contacto_telefono" type="tel" required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      {e._ && <p className="mb-3 text-sm text-red-600">{t('formulario.error')}</p>}
      <BotonEnviar texto={t('acciones.enviar')} textoEnviando={t('acciones.enviando')} />
    </form>
  )
}
