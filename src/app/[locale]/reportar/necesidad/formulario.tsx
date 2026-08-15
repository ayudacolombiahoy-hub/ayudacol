'use client'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { accionReportarNecesidad, type EstadoFormulario } from './acciones'
import Campo from '@/componentes/formularios/Campo'
import SelectCatalogo, { type Opcion } from '@/componentes/formularios/SelectCatalogo'
import Honeypot from '@/componentes/formularios/Honeypot'
import BotonEnviar from '@/componentes/formularios/BotonEnviar'
import { CATEGORIAS, URGENCIAS } from '@/lib/validacion/esquemas'

const inicial: EstadoFormulario = { enviado: false }

export default function FormularioNecesidad({ municipios }: { municipios: Opcion[] }) {
  const t = useTranslations()
  const [estado, accion] = useActionState(accionReportarNecesidad, inicial)

  if (estado.enviado) {
    return <p className="rounded-lg bg-green-100 p-4 font-semibold text-green-900">{t('formulario.gracias')}</p>
  }

  const cats: Opcion[] = CATEGORIAS.map((c) => ({ valor: c, texto: t(`categorias.${c}`) }))
  const urgs: Opcion[] = URGENCIAS.map((u) => ({ valor: u, texto: t(`urgencias.${u}`) }))
  const e = estado.errores ?? {}

  return (
    <form action={accion} className="max-w-lg">
      <Honeypot />
      <Campo etiqueta={t('campos.categoria')} htmlFor="categoria" requerido errores={e.categoria}>
        <SelectCatalogo id="categoria" name="categoria" opciones={cats} placeholder={t('formulario.elige')} requerido />
      </Campo>
      <Campo etiqueta={t('campos.urgencia')} htmlFor="urgencia" requerido errores={e.urgencia}>
        <SelectCatalogo id="urgencia" name="urgencia" opciones={urgs} placeholder={t('formulario.elige')} requerido />
      </Campo>
      <Campo etiqueta={t('campos.municipio')} htmlFor="municipio_id" requerido errores={e.municipio_id}>
        <SelectCatalogo id="municipio_id" name="municipio_id" opciones={municipios} placeholder={t('formulario.elige')} requerido />
      </Campo>
      <Campo etiqueta={t('campos.descripcion')} htmlFor="descripcion" requerido errores={e.descripcion}>
        <textarea id="descripcion" name="descripcion" rows={4} required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('campos.personasAfectadas')} htmlFor="personas_afectadas" errores={e.personas_afectadas}>
        <input id="personas_afectadas" name="personas_afectadas" type="number" min={1}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('campos.detalleUbicacion')} htmlFor="detalle_ubicacion" errores={e.detalle_ubicacion}>
        <input id="detalle_ubicacion" name="detalle_ubicacion" type="text"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
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
