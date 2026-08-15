type Locale = 'es' | 'en'

const RANGOS: [number, Intl.RelativeTimeFormatUnit][] = [
  [60, 'second'],
  [3600, 'minute'],
  [86400, 'hour'],
  [604800, 'day'],
  [2629800, 'week'],
  [31557600, 'month'],
  [Infinity, 'year'],
]

const DIVISOR: Record<string, number> = {
  second: 1, minute: 60, hour: 3600, day: 86400,
  week: 604800, month: 2629800, quarter: 7889400, year: 31557600,
}

export function tiempoRelativo(fecha: string | Date, locale: Locale, ahora: Date = new Date()): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  const seg = Math.round((ahora.getTime() - d.getTime()) / 1000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'always' })
  for (const [limite, unidad] of RANGOS) {
    if (Math.abs(seg) < limite) {
      const valor = Math.round(seg / DIVISOR[unidad])
      return rtf.format(-valor, unidad)
    }
  }
  return rtf.format(-Math.round(seg / DIVISOR.year), 'year')
}

export function esUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}
