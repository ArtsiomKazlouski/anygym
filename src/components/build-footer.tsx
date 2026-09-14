'use client'

/**
 * Версия сборки с перезагрузкой в один тап.
 *
 * Service worker'а нет, приложение ничего не кэширует: любая настоящая
 * перезагрузка даёт свежую версию. Но в установленном приложении нет ни
 * адресной строки, ни кнопки обновления, а iOS при сворачивании усыпляет
 * страницу, а не закрывает — и пользователь видит то, что оставил.
 */
export function BuildFooter({ version }: { version: string }) {
  return (
    <footer className="mt-auto pt-8 text-center text-xs opacity-30">
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="underline-offset-4 transition duration-75 hover:underline active:scale-95"
      >
        сборка {version} · обновить
      </button>
    </footer>
  )
}
