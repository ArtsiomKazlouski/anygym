'use client'

import { useState } from 'react'
import { SubmitButton } from '@/components/submit-button'
import { deletePhoto, savePhoto } from '@/lib/equipment/actions'

const MAX_SIDE = 400
const QUALITY = 0.8

/**
 * Сжатие в браузере перед отправкой.
 *
 * Снимок с телефона — 3-5 МБ. Гнать их на сервер, чтобы сжать там, значит
 * платить трафиком в зале, где связь и так так себе. Узнавание железки
 * требует разрешения уровня превью, не больше.
 *
 * imageOrientation: 'from-image' нужен из-за EXIF: снятое боком фото иначе
 * ляжет повёрнутым.
 */
async function toCompactDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Не удалось подготовить холст')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const webp = canvas.toDataURL('image/webp', QUALITY)
  // Старые браузеры молча отдают PNG вместо WebP — тогда лучше JPEG.
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', QUALITY)
}

export function PhotoUpload({
  modelId,
  currentUrl,
}: {
  modelId: string
  currentUrl: string | null
}) {
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      setPreview(await toCompactDataUrl(file))
    } catch {
      setError('Не удалось обработать снимок. Попробуй другое фото.')
      setPreview(null)
    } finally {
      setBusy(false)
    }
  }

  const shown = preview ?? currentUrl
  const sizeKb = preview ? Math.round((preview.length * 0.75) / 1024) : null

  return (
    <div className="flex flex-col gap-3">
      {shown && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={shown}
          alt="Фото тренажёра"
          className="w-full rounded-2xl border border-black/10 object-cover dark:border-white/15"
        />
      )}

      <form action={savePhoto} className="flex flex-col gap-2">
        <input type="hidden" name="modelId" value={modelId} />
        <input type="hidden" name="photo" value={preview ?? ''} />

        <label className="rounded-xl border border-dashed border-black/20 px-4 py-3 text-center text-sm opacity-70 dark:border-white/25">
          {busy ? 'Сжимаю…' : shown ? 'Переснять' : 'Сделать снимок'}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onPick}
            className="hidden"
          />
        </label>

        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

        {preview && (
          <>
            <p className="text-xs opacity-45">Готово к отправке, около {sizeKb} КБ.</p>
            <SubmitButton className="rounded-xl bg-black py-3 text-sm font-medium text-white dark:bg-white dark:text-black">
              Сохранить фото
            </SubmitButton>
          </>
        )}
      </form>

      {currentUrl && !preview && (
        <form action={deletePhoto} className="text-right">
          <input type="hidden" name="modelId" value={modelId} />
          <SubmitButton className="px-2 py-1 text-xs opacity-35 hover:opacity-100">
            Удалить фото
          </SubmitButton>
        </form>
      )}
    </div>
  )
}
