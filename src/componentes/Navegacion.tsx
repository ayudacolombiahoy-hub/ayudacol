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
    ['/emergencia', t('emergencia')],
    ['/mapa', t('mapa')],
    ['/necesidades', t('necesidades')],
    ['/acopios', t('acopios')],
    ['/voluntarios', t('voluntariado')],
    ['/servicios', t('servicios')],
    ['/donar', t('donar')],
  ]
  return (
    <header className="border-b border-gray-200 bg-white shadow-sm">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 p-3">
        <Link href="/" className="text-lg font-extrabold text-gray-900">🇨🇴 AyudaCol</Link>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {enlaces.map(([href, txt]) => (
            <Link
              key={href}
              href={href}
              className={
                href === '/emergencia'
                  ? 'font-bold text-red-600 hover:text-red-700'
                  : 'font-medium text-gray-800 hover:text-blue-700'
              }
            >
              {href === '/emergencia' ? `🚨 ${txt}` : txt}
            </Link>
          ))}
          {!perfil && <Link href="/entrar" className="font-medium text-gray-800 hover:text-blue-700">{tAuth('entrar')}</Link>}
          {perfil && (perfil.rol === 'moderador' || perfil.rol === 'admin') && (
            <Link href="/panel" className="font-semibold text-blue-700">{tAuth('panel')}</Link>
          )}
          {perfil?.rol === 'admin' && (
            <Link href="/admin/organizaciones" className="font-medium text-gray-800 hover:text-blue-700">{tRoot('admin.titulo')}</Link>
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
