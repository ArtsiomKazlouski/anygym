import { ImageResponse } from 'next/og'

// Иконка рисуется на лету, чтобы не держать в репозитории бинарники,
// которые всё равно пришлось бы пересобирать при смене оформления.
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
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
        fontSize: 92,
        fontWeight: 700,
        letterSpacing: -5,
        // Выносной элемент у «g» тянет визуальный центр вниз —
        // поднимаем текст, чтобы масса легла по центру плашки.
        lineHeight: 1,
        paddingBottom: 23,
      }}
    >
      ag
    </div>,
    size,
  )
}
