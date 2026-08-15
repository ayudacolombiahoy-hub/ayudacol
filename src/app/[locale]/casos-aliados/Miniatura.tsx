'use client'

// Miniatura hotlinked desde mimanizales; si la imagen falla, se oculta.
export function Miniatura({ src }: { src: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      className="h-40 w-full object-cover"
      onError={(e) => {
        ;(e.currentTarget as HTMLImageElement).style.display = 'none'
      }}
    />
  )
}
