export default function Campo({
  etiqueta, htmlFor, requerido, ayuda, errores, children,
}: {
  etiqueta: string
  htmlFor: string
  requerido?: boolean
  ayuda?: string
  errores?: string[]
  children: React.ReactNode
}) {
  return (
    <div className="mb-4">
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-semibold">
        {etiqueta} {requerido && <span className="text-red-600">*</span>}
      </label>
      {children}
      {ayuda && <p className="mt-1 text-xs text-gray-500">{ayuda}</p>}
      {errores?.map((e) => (
        <p key={e} className="mt-1 text-xs text-red-600">{e}</p>
      ))}
    </div>
  )
}
