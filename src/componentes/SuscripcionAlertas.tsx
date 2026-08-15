'use client'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { accionSuscribirAlerta, type EstadoAlerta } from '@/app/[locale]/alertas-accion'
import Campo from '@/componentes/formularios/Campo'
import SelectCatalogo, { type Opcion } from '@/componentes/formularios/SelectCatalogo'
import BotonEnviar from '@/componentes/formularios/BotonEnviar'

const inicial: EstadoAlerta = { enviado: false }

export default function SuscripcionAlertas({ municipios }: { municipios: Opcion[] }) {
  const t = useTranslations('alertas')
  const tf = useTranslations('formulario')
  const ta = useTranslations('acciones')
  const [estado, accion] = useActionState(accionSuscribirAlerta, inicial)
  const e = estado.errores ?? {}

  return (
    <section className="mt-8 max-w-md rounded-lg border border-blue-100 bg-blue-50 p-5">
      <h2 className="text-lg font-bold">{t('titulo')}</h2>
      <p className="mb-4 mt-1 text-sm text-gray-600">{t('intro')}</p>
      {estado.enviado ? (
        <p className="font-semibold text-green-800">{t('gracias')}</p>
      ) : (
        <form action={accion}>
          <Campo etiqueta={t('email')} htmlFor="email" requerido errores={e.email}>
            <input id="email" name="email" type="email" required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </Campo>
          <Campo etiqueta={t('municipioOpcional')} htmlFor="municipio_id" errores={e.municipio_id}>
            <SelectCatalogo id="municipio_id" name="municipio_id" opciones={municipios} placeholder={t('todosMunicipios')} />
          </Campo>
          {e._ && <p className="mb-3 text-sm text-red-600">{tf('error')}</p>}
          <BotonEnviar texto={t('suscribir')} textoEnviando={ta('enviando')} />
        </form>
      )}
    </section>
  )
}
