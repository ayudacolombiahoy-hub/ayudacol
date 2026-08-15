import { useTranslations } from 'next-intl'
export default function Vacio({ mensaje }: { mensaje?: string } = {}) {
  const t = useTranslations('listas')
  return <p className="rounded-lg bg-gray-50 p-8 text-center text-gray-500">{mensaje ?? t('vacio')}</p>
}
