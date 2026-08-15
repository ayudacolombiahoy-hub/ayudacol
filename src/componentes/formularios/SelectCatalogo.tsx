export type Opcion = { valor: string; texto: string }

export default function SelectCatalogo({
  id, name, opciones, placeholder, defaultValue, requerido,
}: {
  id: string
  name: string
  opciones: Opcion[]
  placeholder: string
  defaultValue?: string
  requerido?: boolean
}) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={defaultValue ?? ''}
      required={requerido}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
    >
      <option value="" disabled={requerido}>{placeholder}</option>
      {opciones.map((o) => (
        <option key={o.valor} value={o.valor}>{o.texto}</option>
      ))}
    </select>
  )
}
