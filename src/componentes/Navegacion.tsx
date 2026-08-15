import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navegacion'
import SelectorIdioma from '@/componentes/selector-idioma'

export default async function Navegacion() {
  const t = await getTranslations('nav')
  const enlaces: [string, string][] = [
    ['/necesidades', t('necesidades')],
    ['/acopios', t('acopios')],
    ['/voluntarios', t('voluntariado')],
    ['/servicios', t('servicios')],
  ]
  return (
    <header className="border-b border-gray-200 bg-white">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 p-3">
        <Link href="/" className="font-extrabold">🇨🇴 AyudaCol</Link>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {enlaces.map(([href, txt]) => (
            <Link key={href} href={href} className="text-gray-700 hover:text-blue-700">{txt}</Link>
          ))}
          <SelectorIdioma />
        </div>
      </nav>
    </header>
  )
}
