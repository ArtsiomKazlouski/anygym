import NextAuth from 'next-auth'
import { authConfig } from './auth.config'

// Только проверка JWT — без адаптера и без обращения к БД,
// поэтому proxy спокойно живёт на edge-рантайме.
export default NextAuth(authConfig).auth

export const config = {
  matcher: [
    '/((?!api/auth|signin|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest).*)',
  ],
}
