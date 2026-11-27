import { useCallback, useEffect, useState } from 'react'
import type { RingtoneId } from '../../services/audio/ringtones'
import { loadSettings, saveSettings } from '../../services/settings'
import type { KeyValueStore } from '../../services/storage'

/** Radius and ringtone, remembered between visits. */
export function useSettings(store?: KeyValueStore) {
  const [settings, setSettings] = useState(() => loadSettings(store))

  useEffect(() => {
    saveSettings(settings, store)
  }, [settings, store])

  const setRadiusM = useCallback(
    (radiusM: number) => setSettings((s) => ({ ...s, radiusM })),
    [],
  )
  const setRingtoneId = useCallback(
    (ringtoneId: RingtoneId) => setSettings((s) => ({ ...s, ringtoneId })),
    [],
  )

  const markIntroSeen = useCallback(
    () => setSettings((s) => ({ ...s, introSeen: true })),
    [],
  )

  return { ...settings, setRadiusM, setRingtoneId, markIntroSeen }
}
