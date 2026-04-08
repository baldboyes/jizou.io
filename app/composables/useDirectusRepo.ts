import { createDirectus, rest, staticToken } from '@directus/sdk'
import type { Schema } from '~/types/directus'

let syncPromise: Promise<void> | null = null

export const useDirectusRepo = () => {
  const { user, isLoaded } = useUser() // Clerk user
  const directusUrl = 'https://directus.jizou.io'
  
  // Reuse same state keys to share session with legacy composable if needed, or use new keys.
  // Using same keys 'directus-token' ensures compatibility if user switches between old/new pages.
  const directusToken = useState<string | null>('directus-token', () => null)
  const directusUserId = useState<string | null>('directus-user-id', () => null)

  // Cliente base sin autenticación
  const client = createDirectus<Schema>(directusUrl).with(rest())

  const resetAuth = () => {
    directusToken.value = null
    directusUserId.value = null
    syncPromise = null
  }

  const getClient = async () => {
    // Si ya tenemos token, devolvemos cliente autenticado
    if (directusToken.value) {
      return createDirectus<Schema>(directusUrl)
        .with(staticToken(directusToken.value))
        .with(rest())
    }

    // En SSR, no podemos esperar a Clerk (client-side only)
    if (import.meta.server) {
      return client
    }

    // En cliente, esperar a que Clerk cargue completamente
    if (!isLoaded.value) {
      await new Promise<void>((resolve) => {
        const check = () => {
          if (isLoaded.value) resolve()
          else setTimeout(check, 100)
        }
        check()
      })
    }

    // Si no hay usuario de Clerk, devolvemos cliente público
    if (!user.value) {
      console.log('[DirectusRepo] No user logged in, returning public client')
      return client
    }

    if (!syncPromise) {
      syncPromise = (async () => {
        try {
          // Sincronizar usuario y obtener token
          const response = await $fetch('/api/auth/sync-user', {
            method: 'POST',
            body: {
              email: user.value?.primaryEmailAddress?.emailAddress,
              firstName: user.value?.firstName,
              lastName: user.value?.lastName,
              imageUrl: user.value?.imageUrl
            }
          })
          
          const { token, userId, error, details } = response as any
          
          if (error) {
            console.error('[DirectusRepo] Sync error:', error, details)
            throw new Error(`Authentication failed: ${error} - ${details || ''}`)
          }

          if (token) {
            directusToken.value = token
            if (userId) directusUserId.value = userId
          }
        } catch (e) {
          console.error('[DirectusRepo] Error syncing user:', e)
          resetAuth()
          throw e
        } finally {
          syncPromise = null
        }
      })()
    }

    try {
      await syncPromise

      if (directusToken.value) {
        return createDirectus<Schema>(directusUrl)
          .with(staticToken(directusToken.value))
          .with(rest())
      }
    } catch (e) {
      throw e
    }

    return client
  }

  return {
    getClient,
    resetAuth,
    directusUserId,
    token: directusToken,
    url: directusUrl
  }
}
