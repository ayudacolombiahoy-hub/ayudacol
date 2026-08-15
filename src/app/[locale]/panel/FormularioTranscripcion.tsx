'use client'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { accionTranscribir, type EstadoTranscripcion } from './acciones'
import Campo from '@/componentes/formularios/Campo'
import SelectCatalogo, { type Opcion } from '@/componentes/formularios/SelectCatalogo'
import BotonEnviar from '@/componentes/formularios/BotonEnviar'
import { CATEGORIAS, URGENCIAS } from '@/lib/validacion/esquemas'

const inicial: EstadoTranscripcion = { enviado: false }

export default function FormularioTranscripcion({ municipios }: { municipios: Opcion[] }) {
  const t = useTranslations()
  const [estado, accion] = useActionState(accionTranscribir, inicial)
  const cats: Opcion[] = CATEGORIAS.map((c) => ({ valor: c, texto: t(`categorias.${c}`) }))
  const urgs: Opcion[] = URGENCIAS.map((u) => ({ valor: u, texto: t(`urgencias.${u}`) }))
  const e = estado.errores ?? {}

  return (
    <details className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
      <summary className="cursor-pointer font-bold">📱 {t('panel.transcribir')}</summary>
      {estado.enviado ? (
        <p className="mt-3 rounded bg-green-100 p-3 text-sm text-green-900">{t('formulario.gracias')}</p>
      ) : (
        <form action={accion} className="mt-4 max-w-lg">
          <Campo etiqueta={t('campos.categoria')} htmlFor="tcategoria" requerido errores={e.categoria}>
            <SelectCatalogo id="tcategoria" name="categoria" opciones={cats} placeholder={t('formulario.elige')} requerido />
          </Campo>
          <Campo etiqueta={t('campos.urgencia')} htmlFor="turgencia" requerido errores={e.urgencia}>
            <SelectCatalogo id="turgencia" name="urgencia" opciones={urgs} placeholder={t('formulario.elige')} requerido />
          </Campo>
          <Campo etiqueta={t('campos.municipio')} htmlFor="tmunicipio" requerido errores={e.municipio_id}>
            <SelectCatalogo id="tmunicipio" name="municipio_id" opciones={municipios} placeholder={t('formulario.elige')} requerido />
          </Campo>
          <Campo etiqueta={t('campos.descripcion')} htmlFor="tdesc" requerido errores={e.descripcion}>
            <textarea id="tdesc" name="descripcion" rows={3} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </Campo>
          <Campo etiqueta={t('campos.contactoNombre')} htmlFor="tnombre" requerido errores={e.contacto_nombre}>
            <input id="tnombre" name="contacto_nombre" type="text" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </Campo>
          <Campo etiqueta={t('campos.contactoTelefono')} htmlFor="ttel" requerido errores={e.contacto_telefono}>
            <input id="ttel" name="contacto_telefono" type="tel" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </Campo>
          <BotonEnviar texto={t('panel.guardarTranscripcion')} textoEnviando={t('acciones.enviando')} />
        </form>
      )}
    </details>
  )
}
