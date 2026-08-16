// Normaliza la entrada del formulario múltiple (SubirFotos) a un arreglo de URLs
// válidas. Acepta un arreglo, un valor suelto o vacío; filtra lo que no sea http(s).
// Pura y sin dependencias de servidor, para poder testearla en unit.
// (mascotas/desaparecidos tienen su propia copia local; unificarlas es un cleanup aparte.)
export function fotosDe(entrada: unknown): string[] {
  const e = entrada as { fotos?: unknown } | null
  const raw = Array.isArray(e?.fotos) ? e!.fotos : e?.fotos ? [e!.fotos] : []
  return raw.map((x) => (typeof x === 'string' ? x.trim() : '')).filter((s) => /^https?:\/\//.test(s))
}
