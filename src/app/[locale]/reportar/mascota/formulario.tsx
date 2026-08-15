'use client'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { accionReportarMascota, type EstadoFormulario } from './acciones'
import Campo from '@/componentes/formularios/Campo'
import SelectCatalogo, { type Opcion } from '@/componentes/formularios/SelectCatalogo'
import Honeypot from '@/componentes/formularios/Honeypot'
import BotonEnviar from '@/componentes/formularios/BotonEnviar'
import SubirFoto from '@/componentes/formularios/SubirFoto'

const inicial: EstadoFormulario = { enviado: false }

export default function FormularioMascota({ municipios }: { municipios: Opcion[] }) {
  const t = useTranslations()
  const [estado, accion] = useActionState(accionReportarMascota, inicial)

  if (estado.enviado) {
    return <p className="rounded-lg bg-green-100 p-4 font-semibold text-green-900">{t('mascotas.gracias')}</p>
  }

  const e = estado.errores ?? {}
  const tipos: Opcion[] = [
    { valor: 'perdida', texto: t('mascotas.tipo_perdida') },
    { valor: 'encontrada', texto: t('mascotas.tipo_encontrada') },
  ]
  const especies: Opcion[] = [
    { valor: 'perro', texto: t('mascotas.especie_perro') },
    { valor: 'gato', texto: t('mascotas.especie_gato') },
    { valor: 'ave', texto: t('mascotas.especie_ave') },
    { valor: 'otro', texto: t('mascotas.especie_otro') },
  ]

  return (
    <form action={accion} className="max-w-lg">
      <Honeypot />
      <Campo etiqueta={t('mascotas.campoTipo')} htmlFor="tipo_reporte" requerido errores={e.tipo_reporte}>
        <SelectCatalogo id="tipo_reporte" name="tipo_reporte" opciones={tipos} placeholder={t('formulario.elige')} requerido />
      </Campo>
      <Campo etiqueta={t('mascotas.campoEspecie')} htmlFor="especie" requerido errores={e.especie}>
        <SelectCatalogo id="especie" name="especie" opciones={especies} placeholder={t('formulario.elige')} requerido />
      </Campo>
      <Campo etiqueta={t('mascotas.nombreMascota')} htmlFor="nombre" errores={e.nombre}>
        <input id="nombre" name="nombre" type="text"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('campos.municipio')} htmlFor="municipio_id" errores={e.municipio_id}>
        <SelectCatalogo id="municipio_id" name="municipio_id" opciones={municipios} placeholder={t('formulario.elige')} />
      </Campo>
      <Campo etiqueta={t('mascotas.ultimaUbicacion')} htmlFor="ultima_ubicacion" errores={e.ultima_ubicacion}>
        <input id="ultima_ubicacion" name="ultima_ubicacion" type="text"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('campos.descripcion')} htmlFor="descripcion" requerido errores={e.descripcion}>
        <textarea id="descripcion" name="descripcion" rows={4} required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <SubirFoto name="foto_url" />
      <Campo etiqueta={t('campos.contactoNombre')} htmlFor="contacto_nombre" requerido errores={e.contacto_nombre}>
        <input id="contacto_nombre" name="contacto_nombre" type="text" required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      <Campo etiqueta={t('campos.contactoTelefono')} htmlFor="contacto_telefono" requerido
        ayuda={t('mascotas.telefonoPublico')} errores={e.contacto_telefono}>
        <input id="contacto_telefono" name="contacto_telefono" type="tel" required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Campo>
      {e._ && <p className="mb-3 text-sm text-red-600">{t('formulario.error')}</p>}
      <BotonEnviar texto={t('acciones.enviar')} textoEnviando={t('acciones.enviando')} />
    </form>
  )
}
