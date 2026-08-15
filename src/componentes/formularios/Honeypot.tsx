export default function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute left-[-9999px] top-[-9999px]" tabIndex={-1}>
      <label htmlFor="sitio_web">No llenar</label>
      <input id="sitio_web" name="sitio_web" type="text" autoComplete="off" tabIndex={-1} />
    </div>
  )
}
