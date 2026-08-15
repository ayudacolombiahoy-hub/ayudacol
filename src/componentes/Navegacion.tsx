import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navegacion'
import SelectorIdioma from '@/componentes/selector-idioma'
import { obtenerPerfil } from '@/lib/auth/sesion'

export default async function Navegacion() {
  const t = await getTranslations('nav')
  const tAuth = await getTranslations('auth')
  const tRoot = await getTranslations()
  const perfil = await obtenerPerfil()
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
          {!perfil && <Link href="/entrar" className="text-gray-700 hover:text-blue-700">{tAuth('entrar')}</Link>}
          {perfil && (perfil.rol === 'moderador' || perfil.rol === 'admin') && (
            <Link href="/panel" className="font-semibold text-blue-700">{tAuth('panel')}</Link>
          )}
          {perfil?.rol === 'admin' && (
            <Link href="/admin/organizaciones" className="text-gray-700 hover:text-blue-700">{tRoot('admin.titulo')}</Link>
          )}
          {perfil?.rol === 'org' && (
            <Link href="/org" className="font-semibold text-blue-700">{tRoot('org.titulo')}</Link>
          )}
          <SelectorIdioma />
        </div>
      </nav>
    </header>
  )
}
