import { test, expect } from 'vitest'
import es from '../../src/messages/es.json'
import en from '../../src/messages/en.json'

function claves(obj: Record<string, unknown>, prefijo = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v !== null && typeof v === 'object'
      ? claves(v as Record<string, unknown>, `${prefijo}${k}.`)
      : [`${prefijo}${k}`]
  )
}

test('es.json y en.json tienen exactamente las mismas claves', () => {
  expect(claves(en).sort()).toEqual(claves(es).sort())
})
