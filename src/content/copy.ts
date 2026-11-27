/**
 * All user-facing strings live here so a Tagalog/English toggle
 * can be added later without touching components.
 */
export const copy = {
  appName: 'Para Po',
  tagline: 'Your stop, never missed.',
  map: {
    label: 'Map. Tap to set your stop.',
    destinationMarker: 'Your stop',
  },
  setup: {
    sectionLabel: 'Trip setup',
    emptyTitle: 'Where are you getting off?',
    emptyHint: 'Tap the map to drop a pin on your stop.',
    destinationTitle: 'Your stop',
    destinationHint: 'Tap the map or drag the pin to move it.',
    clear: 'Clear',
  },
  radius: {
    label: 'Alert me within',
    hint: 'Go bigger for fast rides like the MRT or LRT.',
  },
  alarm: {
    title: 'Para po!',
    body: "You're near your stop.",
  },
} as const
