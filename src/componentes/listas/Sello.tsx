import { useTranslations } from 'next-intl'

const COLOR: Record<string, string> = {
  sin_verificar: 'bg-gray-200 text-gray-700',
  verificada: 'bg-blue-100 text-blue-800',
  en_atencion: 'bg-purple-100 text-purple-800',
  resuelta: 'bg-green-100 text-green-800',
  por_reconfirmar: 'bg-amber-100 text-amber-800',
}

export default function Sello({ estado }: { estado: string }) {
  const t = useTranslations('estados')
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${COLOR[estado] ?? 'bg-gray-100 text-gray-600'}`}>
      {estado === 'verificada' ? '✓ ' : ''}{t(estado)}
    </span>
  )
}
