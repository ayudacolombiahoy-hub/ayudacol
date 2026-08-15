export const dynamic = 'force-dynamic'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { listarMunicipios } from '@/lib/datos/consultas'
import FormularioMascota from './formulario'

export default async function Pagina({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('mascotas')
  const municipios = (await listarMunicipios()).map((m) => ({
    valor: m.codigo_dane,
    texto: `${m.nombre} — ${m.departamento}`,
  }))
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-extrabold">{t('formTitulo')}</h1>
      <FormularioMascota municipios={municipios} />
    </main>
  )
}
