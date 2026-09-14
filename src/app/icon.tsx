import { ImageResponse } from 'next/og'

// Иконка рисуется на лету, чтобы не держать в репозитории бинарники,
// которые всё равно пришлось бы пересобирать при смене оформления.
export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
        color: '#ffffff',
        fontSize: 260,
        fontWeight: 700,
        letterSpacing: -14,
        // Выносной элемент у «g» тянет визуальный центр вниз —
        // поднимаем текст, чтобы масса легла по центру плашки.
        lineHeight: 1,
        paddingBottom: 66,
      }}
    >
      ag
    </div>,
    size,
  )
}
