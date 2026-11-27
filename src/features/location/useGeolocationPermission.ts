import { useEffect, useState } from 'react'

export type GeolocationPermission = PermissionState | 'unknown'

/**
 * Current geolocation permission, kept in sync if the user changes it.
 * 'unknown' when the Permissions API isn't available (older Safari).
 */
export function useGeolocationPermission(
  enabled = true,
): GeolocationPermission {
  const [state, setState] = useState<GeolocationPermission>('unknown')

  useEffect(() => {
    const permissions = globalThis.navigator?.permissions
    if (!enabled || !permissions?.query) return

    let cancelled = false
    let status: PermissionStatus | undefined
    const onChange = () => {
      if (status) setState(status.state)
    }

    permissions
      .query({ name: 'geolocation' })
      .then((result) => {
        if (cancelled) return
        status = result
        setState(result.state)
        result.addEventListener('change', onChange)
      })
      .catch(() => {
        // Some browsers reject unknown permission names; stay 'unknown'.
      })

    return () => {
      cancelled = true
      status?.removeEventListener('change', onChange)
    }
  }, [enabled])

  return state
}
