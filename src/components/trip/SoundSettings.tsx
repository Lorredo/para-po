import { useEffect, useId, useState } from 'react'
import { copy } from '../../content/copy'
import type { AlarmAudio } from '../../services/audio/alarmAudio'
import {
  isRingtoneId,
  RINGTONE_IDS,
  type RingtoneId,
} from '../../services/audio/ringtones'

type SoundSettingsProps = {
  audio: AlarmAudio
  ringtoneId: RingtoneId
  onRingtoneChange: (id: RingtoneId) => void
  onTestAlarm: () => void
}

/** Pick a ringtone, hear it, or run a full test of the alarm screen. */
export function SoundSettings({
  audio,
  ringtoneId,
  onRingtoneChange,
  onTestAlarm,
}: SoundSettingsProps) {
  const selectId = useId()
  const hintId = useId()
  const [previewing, setPreviewing] = useState(false)
  const supported = audio.supported

  // Stop a preview if this panel goes away mid-sound.
  useEffect(
    () => () => {
      if (previewing) audio.stop()
    },
    [audio, previewing],
  )

  function togglePreview() {
    if (previewing) {
      audio.stop()
      setPreviewing(false)
      return
    }
    // This tap is what lets the browser play sound later, on arrival.
    void audio.unlock()
    audio.play(ringtoneId, {
      loop: false,
      onEnded: () => setPreviewing(false),
    })
    setPreviewing(true)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label htmlFor={selectId} className="text-sm font-semibold text-ink">
          {copy.sound.label}
        </label>
        <button
          type="button"
          onClick={onTestAlarm}
          disabled={!supported}
          className="rounded text-sm font-semibold text-navy underline underline-offset-2 hover:text-navy/80 focus-visible:ring-2 focus-visible:ring-navy focus-visible:outline-none disabled:opacity-50"
        >
          {copy.sound.test}
        </button>
      </div>
      <div className="flex gap-2">
        <select
          id={selectId}
          value={ringtoneId}
          disabled={!supported}
          aria-describedby={hintId}
          onChange={(event) => {
            if (!isRingtoneId(event.target.value)) return
            if (previewing) {
              audio.stop()
              setPreviewing(false)
            }
            onRingtoneChange(event.target.value)
          }}
          className="min-w-0 flex-1 rounded-xl border border-ink/15 bg-white px-3 py-2 text-base text-ink focus-visible:ring-2 focus-visible:ring-navy focus-visible:outline-none disabled:opacity-50"
        >
          {RINGTONE_IDS.map((id) => (
            <option key={id} value={id}>
              {copy.sound.ringtones[id]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={togglePreview}
          disabled={!supported}
          aria-pressed={previewing}
          className="shrink-0 rounded-xl border border-navy/20 px-4 py-2 text-sm font-semibold text-navy hover:bg-navy/5 focus-visible:ring-2 focus-visible:ring-navy focus-visible:outline-none disabled:opacity-50"
        >
          {previewing ? copy.sound.stopPreview : copy.sound.preview}
        </button>
      </div>
      <p id={hintId} className="text-xs text-ink/70">
        {supported ? copy.sound.volumeHint : copy.sound.unsupported}
      </p>
    </div>
  )
}
