export const dynamic = 'force-dynamic'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { listarMunicipios } from '@/lib/datos/consultas'
import FormularioProponerAcopio from './formulario'

export default async function Pagina({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('acopiosPublico')
  const municipios = (await listarMunicipios()).map((m) => ({
    valor: m.codigo_dane,
    texto: `${m.nombre} — ${m.departamento}`,
  }))
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-2 text-2xl font-extrabold">{t('proponerTitulo')}</h1>
      <p className="mb-6 text-sm text-gray-600">{t('intro')}</p>
      <FormularioProponerAcopio municipios={municipios} />
    </main>
  )
}
