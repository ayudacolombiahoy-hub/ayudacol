'use client'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { accionReportarServicio, type EstadoFormulario } from './acciones'
import Campo from '@/componentes/formularios/Campo'
import SelectCatalogo, { type Opcion } from '@/componentes/formularios/SelectCatalogo'
import Honeypot from '@/componentes/formularios/Honeypot'
import BotonEnviar from '@/componentes/formularios/BotonEnviar'
import { TIPOS_SERVICIO } from '@/lib/validacion/esquemas'

const inicial: EstadoFormulario = { enviado: false }

export default function FormularioServicio({ municipios }: { municipios: Opcion[] }) {
  const t = useTranslations()
  const [estado, accion] = useActionState(accionReportarServicio, inicial)
  if (estado.enviado) {
    return <p className="rounded-lg bg-green-100 p-4 font-semibold text-green-900">{t('formulario.gracias')}</p>
  }
  const tipos: Opcion[] = TIPOS_SERVICIO.map((s) => ({ valor: s, texto: t(`tiposServicio.${s}`) }))
  const e = estado.errores ?? {}
  return (
    <form action={accion} className="max-w-lg">
      <Honeypot />
      <Campo etiqueta={t('campos.tipoServicio')} htmlFor="tipo" requerido errores={e.tipo}>
        <SelectCatalogo id="tipo" name="tipo" opciones={tipos} placeholder={t('formulario.elige')} requerido />
      </Campo>
      <Campo etiqueta={t('campos.descripcion')} htmlFor="descripcion" requerido errores={e.descripcion}>
        <textarea id="descripcion" name="descripcion" rows={4} required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('campos.capacidad')} htmlFor="capacidad" errores={e.capacidad}>
        <input id="capacidad" name="capacidad" type="text"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('campos.municipio')} htmlFor="municipio_id" requerido errores={e.municipio_id}>
        <SelectCatalogo id="municipio_id" name="municipio_id" opciones={municipios} placeholder={t('formulario.elige')} requerido />
      </Campo>
      <Campo etiqueta={t('campos.contactoNombre')} htmlFor="contacto_nombre" requerido errores={e.contacto_nombre}>
        <input id="contacto_nombre" name="contacto_nombre" type="text" required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
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
