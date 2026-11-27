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
  search: {
    label: 'Search for your stop',
    placeholder: 'Station or landmark, e.g. Cubao',
    submit: 'Search',
    searching: 'Searching…',
    tooShort: 'Type at least 3 letters.',
    noResults:
      'No places found. Try a station or landmark name, like "Ayala Station", or tap the map.',
    resultsFound: (count: number) =>
      count === 1 ? '1 place found' : `${count} places found`,
    errors: {
      'rate-limited': 'Search is busy right now. Wait a moment and try again.',
      network: "Can't reach search. Check your connection, or tap the map.",
      server: 'Search is having trouble right now. Tap the map instead.',
    },
    credit: 'Search by Nominatim · © OpenStreetMap contributors',
  },
  setup: {
    sectionLabel: 'Trip setup',
    emptyTitle: 'Where are you getting off?',
    emptyHint: 'Search above, or tap the map to drop a pin on your stop.',
    destinationTitle: 'Your stop',
    droppedPin: 'Dropped pin',
    destinationHint: 'Tap the map or drag the pin to move it.',
    clear: 'Clear',
  },
  location: {
    locate: 'Show my location',
    recenter: 'Center on my location',
    explainer: {
      title: 'Allow location?',
      body: "Para Po uses your location to know when you're close to your stop. It stays on your phone and is never uploaded.",
      allow: 'Allow location',
      notNow: 'Not now',
    },
    locating: 'Finding your location…',
    weakSignal:
      'GPS signal is weak, so the distance may be off. Try near a window.',
    signalLost:
      'Lost GPS signal (tunnels and covered stations do this). Still trying. If it keeps up, check that Location is on for your phone.',
    toStop: 'to your stop',
    accuracy: (meters: number) => `GPS accuracy ±${Math.round(meters)} m`,
    dismiss: 'OK',
    errors: {
      'permission-denied': {
        title: 'Location is blocked',
        body: 'Turn it on, then tap the location button again. Android Chrome: tap the icon left of the address › Permissions › Location. iPhone: Settings › Privacy & Security › Location Services › Safari Websites.',
      },
      insecure: {
        title: 'Location needs a secure connection',
        body: 'Open Para Po with an https:// address to use your location.',
      },
      unsupported: {
        title: "This browser can't share location",
        body: 'Try the latest Chrome or Safari.',
      },
    },
  },
  sim: {
    label: 'Simulated ride controls',
    badge: 'Demo ride',
    startHint: 'Set the stop, then tap Start trip below.',
    play: 'Play',
    pause: 'Pause',
    speed: 'Playback speed',
    progress: 'Ride progress',
    progressText: (done: string, total: string) => `${done} of ${total}`,
    useStop: (name: string) => `Set stop: ${name}`,
  },
  trip: {
    start: 'Start trip',
    needStop: 'Set your stop first: search above or tap the map.',
    end: 'End trip',
    yourStop: 'your stop',
    settingsSummary: (radius: string, sound: string) =>
      `Alarm settings · ${radius} · ${sound}`,
    screenOn: 'Screen will stay on. Keep Para Po open until your stop.',
    wakeLockUnavailable:
      "This browser can't keep your screen on. Keep Para Po open and turn off auto-lock, or the alarm may not ring.",
    startedNear: (name: string) =>
      `You're already near ${name}. Para Po will ring after you move away and come back.`,
    gpsStale:
      'No GPS update for 30 seconds, so the distance may be out of date.',
    poorAccuracy: (meters: number) =>
      `GPS accuracy is poor (±${meters} m). Waiting for a better reading.`,
    ended: {
      title: 'Ingat! Safe travels.',
      body: 'Trip finished.',
      done: 'Plan another trip',
    },
  },
  radius: {
    label: 'Alert me within',
    hint: 'Go bigger for fast rides like the MRT or LRT.',
  },
  sound: {
    label: 'Alarm sound',
    preview: 'Preview',
    stopPreview: 'Stop',
    test: 'Test alarm',
    volumeHint: "Turn your volume up. Para Po can't change it for you.",
    unsupported: "This browser can't play alarm sounds.",
    ringtones: {
      jeepney: 'Jeepney beep',
      bell: 'Bell',
      chime: 'Chime',
      beeps: 'Beeps',
    },
  },
  alarm: {
    title: 'Para po!',
    body: {
      arrived: "You're near your stop.",
      passed: 'You may have just passed your stop.',
      test: 'This is how your alarm will sound.',
    },
    whereWithDistance: (name: string, distance: string) =>
      `${name} · ${distance} away`,
    stop: "I'm getting off",
    done: 'Done',
    snooze: 'Snooze 1 min',
    snoozed: (seconds: number) => `Snoozed. Ringing again in ${seconds} s.`,
  },
} as const
