import { and, eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import { equipmentModels } from '@/db/schema'

/**
 * Байты фото железки.
 *
 * Отдельным маршрутом, а не в составе страницы: картинка не должна ехать
 * в разметку при каждом рендере. Доступ закрыт так же, как всё остальное —
 * это личные данные.
 *
 * Адрес несёт версию (?v=updatedAt), поэтому кэшировать можно надолго:
 * поменял фото — поменялся и адрес.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return new Response(null, { status: 401 })

  const [row] = await db
    .select({ photo: equipmentModels.photo, mime: equipmentModels.photoMime })
    .from(equipmentModels)
    .where(and(eq(equipmentModels.id, id), eq(equipmentModels.userId, userId)))

  if (!row?.photo) return new Response(null, { status: 404 })

  return new Response(new Uint8Array(row.photo), {
    headers: {
      'content-type': row.mime ?? 'image/webp',
      'cache-control': 'private, max-age=31536000, immutable',
    },
  })
}
