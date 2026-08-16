'use client'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { accionReportarDesaparecido, type EstadoFormulario } from './acciones'
import Campo from '@/componentes/formularios/Campo'
import SelectCatalogo, { type Opcion } from '@/componentes/formularios/SelectCatalogo'
import Honeypot from '@/componentes/formularios/Honeypot'
import BotonEnviar from '@/componentes/formularios/BotonEnviar'
import SubirFotos from '@/componentes/formularios/SubirFotos'

const inicial: EstadoFormulario = { enviado: false }

export default function FormularioDesaparecido({ municipios }: { municipios: Opcion[] }) {
  const t = useTranslations()
  const [estado, accion] = useActionState(accionReportarDesaparecido, inicial)

  if (estado.enviado) {
    return <p className="rounded-lg bg-green-100 p-4 font-semibold text-green-900">{t('desaparecidos.gracias')}</p>
  }

  const e = estado.errores ?? {}

  return (
    <form action={accion} className="max-w-lg">
      <Honeypot />
      <Campo etiqueta={t('desaparecidos.nombrePersona')} htmlFor="nombre" requerido errores={e.nombre}>
        <input id="nombre" name="nombre" type="text" required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('desaparecidos.edad')} htmlFor="edad" errores={e.edad}>
        <input id="edad" name="edad" type="number" min={0} max={129}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('campos.municipio')} htmlFor="municipio_id" errores={e.municipio_id}>
        <SelectCatalogo id="municipio_id" name="municipio_id" opciones={municipios} placeholder={t('formulario.elige')} />
      </Campo>
      <Campo etiqueta={t('desaparecidos.ultimaUbicacion')} htmlFor="ultima_ubicacion" errores={e.ultima_ubicacion}>
        <input id="ultima_ubicacion" name="ultima_ubicacion" type="text"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('campos.descripcion')} htmlFor="descripcion" requerido errores={e.descripcion}>
        <textarea id="descripcion" name="descripcion" rows={4} required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <SubirFotos name="fotos" />
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
