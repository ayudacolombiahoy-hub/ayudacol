// Contacto genérico de una necesidad: puede ser un teléfono, un usuario de
// Instagram (@usuario) o un enlace (Instagram/Facebook/otro). Se guarda tal cual
// en `contacto_telefono`; estas funciones deciden cómo mostrarlo en la UI.

export type TipoContacto = 'telefono' | 'instagram' | 'facebook' | 'link'

// Clasifica un contacto para elegir el render (WhatsApp/llamar, Instagram, etc.).
export function clasificarContacto(valor: string | null | undefined): TipoContacto {
  const v = (valor ?? '').trim()
  if (/instagram\.com/i.test(v)) return 'instagram'
  if (/facebook\.com|fb\.com|fb\.me/i.test(v)) return 'facebook'
  if (/^https?:\/\//i.test(v)) return 'link'
  if (v.startsWith('@')) return 'instagram'
  if (v.replace(/\D/g, '').length >= 7) return 'telefono'
  return 'link'
}

// href para abrir un contacto no telefónico (Instagram/Facebook/enlace).
export function hrefContacto(valor: string): string {
  const v = valor.trim()
  if (/^https?:\/\//i.test(v)) return v
  if (v.startsWith('@')) return `https://instagram.com/${v.replace(/^@+/, '')}`
  return `https://${v}`
}
