import { useEffect, useState, type ReactNode } from 'react'
import QRCode from 'qrcode'

/** QR generado localmente en el navegador (sin servicios externos). */
export default function Qr({ texto, etiqueta }: { texto: string; etiqueta?: ReactNode }) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    QRCode.toString(texto, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b0f17', light: '#ffffff' } })
      .then(setSvg)
      .catch(() => setSvg(''))
  }, [texto])
  return (
    <figure className="qr">
      <div className="qr__img" dangerouslySetInnerHTML={{ __html: svg }} />
      {etiqueta && <figcaption>{etiqueta}</figcaption>}
    </figure>
  )
}
