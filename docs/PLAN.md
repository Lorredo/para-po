# Para Po: Build Plan

> Your stop, never missed.

This is the living plan for Para Po, a web-based destination alarm (PWA) for jeepney, bus and train commuters in the Philippines. It is updated at the end of every milestone.

- **Live:** https://para-po-alpha.vercel.app/
- **Demo ride (no travel needed):** https://para-po-alpha.vercel.app/?sim=edsa&speed=10

## Status

| Milestone                                      | Status  |
| ---------------------------------------------- | ------- |
| M0 Project setup and first deploy              | ✅ Done |
| M1 Map, tap to set stop, radius circle         | ✅ Done |
| M2 Destination search                          | ✅ Done |
| M3 Live location, distance readout, demo ride  | ✅ Done |
| M4 Geofence logic ("when to ring"), test-first | ✅ Done |
| M5 Audio, vibration and alarm screen           | ✅ Done |
| M6 Trip start/stop and screen wake lock        | ⏭ Next  |
| M7 Installable PWA and offline app shell       | Planned |
| M8 Resilience and polish                       | Planned |
| M9 Real-ride field test and portfolio README   | Planned |

## Goals and constraints

- **Who it's for:** commuters in Metro Manila, mostly on Android, some on iPhone.
- **Why a web version:** the native version already exists. This one shows the trade-offs between native and web and handles them honestly.
- **Budget:** $0. Free tools and free hosting tiers only.
- **No backend.** Nothing needs a server, and location never leaves the phone.
- **Web limits we design around:**
  - Browsers stop tracking and playing sound when the screen locks, so the app keeps the screen on (Wake Lock API) and says so clearly.
  - Sound only plays after a tap, so "Start trip" also unlocks audio.
  - Geolocation needs HTTPS.
  - iOS Safari has stricter PWA limits than Android Chrome.
- **OpenStreetMap policies:**
  - Map tiles: show attribution and never bulk-download.
  - Nominatim search: at most 1 request per second, no search-as-you-type, cache results.

## Tech stack

| Choice                                    | Why                                                                                                              |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Vite 8 + React 19 + TypeScript 7 (strict) | Familiar to reviewers. Core logic stays in plain TypeScript modules with no React imports, so it's easy to test. |
| Leaflet 1.9 + react-leaflet 5             | Free and light, with OSM attribution built in.                                                                   |
| OpenStreetMap tiles                       | Free. CARTO Voyager is set up as a no-key fallback in `src/config/map.ts`.                                       |
| Nominatim                                 | Free place search. Photon is the fallback if we ever need search-as-you-type.                                    |
| Tailwind CSS v4                           | Mobile-first styling, with brand colours as theme tokens.                                                        |
| oxlint + Prettier                         | oxlint is what the current Vite template ships and is much faster than ESLint, so we kept it.                    |
| Vitest + Testing Library                  | Unit and component tests.                                                                                        |
| Playwright                                | End-to-end tests on an emulated Pixel 7, with emulated geolocation. Tile and search requests are always mocked.  |
| vite-plugin-pwa (M7)                      | Manifest, service worker and precaching.                                                                         |
| Vercel (Hobby)                            | Free HTTPS, preview URLs, and custom headers. Deploys automatically from `main`.                                 |

## Architecture

```
 UI (React) ──actions──▶ App / useTrip (orchestrator) ◀── trip state
                               │
   ┌──────────────┬────────────┼─────────────┬─────────────┐
 LocationProvider  geofence    AlarmAudio    WakeLock      Vibration
 (browser | sim)   (pure)      (M5)          (M6)          (M5)
```

- **`src/lib/geo/`**: pure geometry with no browser APIs. Includes haversine distance, offsets, polylines, closest approach to a segment, formatting, and the geofence evaluator ("when to ring"). Kept at 100% test coverage.
- **`src/services/`**: browser-facing services.
  - `geocoding.ts`: Nominatim client with rate limiting, cache and cancellation.
  - `storage.ts`: safe localStorage.
  - `location/`: location providers.
  - Coming later: audio (M5) and wake lock (M6).
- **`src/features/`**: React hooks that wire services into state, such as `useLocationTracking` and `useGeolocationPermission`.
- **`src/components/`**: UI only.
- **`src/content/copy.ts`**: every user-facing string, ready for a Tagalog/English toggle.

**LocationProvider.** A single interface with two implementations:

- **browser:** real GPS through `watchPosition`;
- **simulated:** replays a route with play/pause, speed and seek.

The rest of the app can't tell which one it's using. That makes testing and the public demo ride possible.

**Planned trip flow (M6).** All of these run inside the Start tap, because browsers only allow sound after a user tap:

1. Unlock and preload the alarm audio.
2. Request a screen wake lock.
3. Start location tracking.

From then on, each GPS fix goes to `geofence.evaluate()` (a pure function). When it returns `ARRIVE`, the app plays the alarm and vibrates. The alarm screen reads "Para po! You're near your stop." with **Snooze 1 min** and **I'm getting off** buttons.

## Milestones

### ✅ M0: Project setup and first deploy

- [x] `para-po` repo: Vite + React + TS, linting, Prettier, Tailwind, Vitest
- [x] Deployed on Vercel over HTTPS, opens on a phone
- [x] Page title, logo and brand colours in place

### ✅ M1: Map and destination

- [x] Leaflet map centred on Metro Manila, OSM attribution visible
- [x] Tap the map to set or move the stop; the pin can also be dragged
- [x] Radius slider (100 m to 2 km, step 50 m, default 300 m) updates the circle live
- [x] Playwright end-to-end tests on a mobile viewport

### ✅ M2: Destination search

- [x] Nominatim search runs on submit only, never as you type
- [x] Results limited to the Philippines and ranked toward Metro Manila
- [x] Requests spaced 1.1 s apart, with a 5 s back-off after HTTP 429; stale requests cancelled
- [x] 50-query cache kept for 7 days in memory and localStorage
- [x] Picking a result sets a named stop and flies the map to frame its radius
- [x] Each result shows its kind (Train station, Bus stop, Mall…)
- [x] Commuter shorthand rewrite: "Ayala MRT" is searched as "ayala station" (see Decisions)

### ✅ M3: Live location

- [x] `LocationProvider` interface with browser and simulated providers (`?sim=edsa&speed=N`)
- [x] Blue dot with accuracy halo; locate/recenter button
- [x] Live straight-line distance to the stop, with GPS accuracy
- [x] Explains before the browser's permission prompt; separate UI for blocked, lost signal, weak signal, insecure page and unsupported browser
- [x] Demo ride controls: play/pause, 1×/10×/50×, progress scrubber, "Set stop: Ayala"

### ✅ M4: Geofence logic (test-first)

- [x] `src/lib/geo/geofence.ts`: a pure `evaluateGeofence(state, fix, destination, config, now)` that returns `{ state, distanceM, accepted, rejectReason?, event? }`
- [x] Ignore readings worse than 150 m accuracy, older than 15 s, out of order, or an impossible jump (over 60 m/s after allowing for GPS error)
- [x] `arrived` after **2 readings in a row** inside the radius
- [x] **`passed`:** the path travelled between readings came within radius + accuracy, then moved away for 2 readings and at least max(accuracy, 30 m) past the closest point. Measured on the line between readings (`segment.ts`), so a fast train that skips the radius is still caught.
- [x] `started-near`: starting within radius + accuracy is flagged; nothing rings until the user has moved clearly away
- [x] Tests written first. They cover: normal approach, GPS noise (25 seeds), edge jitter, glitches, recovering from a bad first reading, inaccurate, stale and out-of-order readings, fast pass-through, grazing the edge, radius changes mid-ride, starting near, and the EDSA demo route.
- [x] **Sweep:** 4 speeds × 4 reading gaps × 3 radii (48 cases) never stay silent; roads 450 m away never ring
- [x] 100% statement, branch, function and line coverage of `src/lib/geo`, enforced in `vite.config.ts`

### ✅ M5: Audio and alarm screen

- [x] Four original ringtones synthesised with Web Audio (Jeepney beep, Bell, Chime, Beeps): no files, no licensing, works offline
- [x] `src/services/audio/alarmAudio.ts`:
  - unlock inside a tap (a silent one-sample sound for iOS);
  - asks Safari 17+ to keep playing with the silent switch on (`navigator.audioSession`);
  - looped playback scheduled 1.5 s ahead, which doesn't try to catch up after throttling;
  - an 8 s volume build-up for real alarms;
  - a clean fade-out on stop.
- [x] The AudioContext is created only inside the first tap, never on page load
- [x] Vibration repeats a 700/300 ms pattern while ringing; no-op on iOS; never calls the hardware unless it actually started
- [x] Sound picker with Preview (plays one cycle) and **Test alarm** (full alarm screen and sound) so riders can check volume before a trip
- [x] Full-screen alarm: "Para po!", with separate wording for _arrived_, _may have passed_ and _test_; stop name and distance; **I'm getting off** and **Snooze 1 min**; first button focused; bell animation respects reduced motion
- [x] `useAlarm` hook: ring, stop, and snooze with a countdown notice. After a snooze it asks `shouldRingAgain()` (M6 will check you're still near).
- [x] End-to-end tests in real Chromium check real Web Audio (the context runs, notes keep being scheduled, nothing after stop) and vibration calls

### ⏭ M6: Trip flow and wake lock

- [ ] Start/Stop trip runs the flow above; location starts automatically with the trip
- [ ] Wake lock re-acquired when the tab becomes visible again; a banner if it can't be acquired
- [ ] Watchdog: "GPS signal weak" if no fix for 30 s
- [ ] A full demo ride rings the alarm on a real Android phone
- [ ] Last-used radius and ringtone persist across reloads

### M7: Installable PWA

- [ ] Manifest: name and short_name "Para Po", theme colour, maskable icons, Apple touch icon
- [ ] Service worker precaches the app shell and sounds; works offline with a friendly offline-map state
- [ ] Android install prompt; iOS "Share › Add to Home Screen" instructions
- [ ] Update toast when a new version ships
- [ ] `vercel.json`: no-cache for `sw.js` and the manifest

### M8: Resilience and polish

- [ ] First-run explainer: keep Para Po open with the screen on
- [ ] Banner when returning to the app: "Tracking may have paused while you were away"
- [ ] Accessibility pass: contrast, focus, screen-reader announcements, reduced motion
- [ ] A visible "Try a demo ride" entry point

### M9: Field test and portfolio

- [ ] One real ride with a track recorder; the recording becomes a test fixture
- [ ] iOS and Android compatibility matrix from real devices
- [ ] README: story behind the name, limitations and trade-offs, native vs web comparison, screenshots and demo GIF

## Stretch features (after the MVP)

- Saved favourite destinations (IndexedDB)
- Multiple alarms
- Off-route warning
- Battery and GPS-signal warnings
- Dark mode (CARTO dark tiles)
- Tagalog/English toggle (all text is already in `copy.ts`)

## Decisions log

Choices made during the build, and why.

| When | Decision                                                            | Why                                                                                                                                                                                                                 |
| ---- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0   | Kept **oxlint** instead of ESLint                                   | It's the current Vite template default, and much faster.                                                                                                                                                            |
| M1   | Custom pin as an inline-SVG `divIcon`                               | On brand, and avoids Leaflet's default marker images, whose paths break under bundlers.                                                                                                                             |
| M1   | Tests block all OSM tile requests                                   | Respects the tile usage policy.                                                                                                                                                                                     |
| M2   | Search on submit only                                               | Nominatim's policy forbids search-as-you-type.                                                                                                                                                                      |
| M2   | Rewrite "X MRT", "X LRT 2" and "X PNR" to "x station"               | Testing with real data showed Nominatim matches "Ayala MRT" to the MRT rail line near TriNoma, but "Ayala Station" finds the right place. A bare "MRT 3" is left alone.                                             |
| M2   | Show a kind label on each result                                    | The same name often means several places (SM Megamall is both the mall and the bus stop).                                                                                                                           |
| M3   | **"Position unavailable" is a warning, not fatal**                  | Found by an end-to-end test: Chromium reports it whenever the position source changes, and keeps watching. On real commutes it happens in tunnels and covered stations. Stopping there would mean missing the stop. |
| M3   | Explain before the browser's permission prompt                      | An unexplained prompt is the most common reason people tap "Block". Skipped when permission is already granted.                                                                                                     |
| M3   | Location starts on tap only (until M6)                              | No GPS use while the user is only planning a trip.                                                                                                                                                                  |
| M3   | Demo route follows EDSA via MRT-3 stations and continues past Ayala | It's realistic, and running past the stop lets us test passed-stop detection in M4.                                                                                                                                 |
| M3   | Straight-line distance                                              | A destination alarm only needs "how close am I", not the road distance.                                                                                                                                             |
| M4   | Check the path between readings, not just the readings              | With readings 30 s apart on a fast train, no reading may land inside the radius even though the ride went straight past the stop.                                                                                   |
| M4   | Reject impossible jumps (over 60 m/s after GPS error)               | Found while designing the tests: one glitch reading near the stop could later turn ordinary traffic jitter 800 m away into a false "passed" alarm.                                                                  |
| M4   | On a second "jump" in a row, trust the new reading                  | If the reading we trusted was the glitch, every real reading after it looks like a jump. Without this, one bad first reading would block the alarm for the whole ride.                                              |
| M4   | A near miss counts as "passed"                                      | Passing within radius + GPS accuracy and then moving away rings with "you may have passed your stop". Ringing slightly early costs little; staying silent costs the stop.                                           |
| M4   | Separate "passed" from "arrived"                                    | The alarm screen can be honest ("You may have just passed your stop") instead of pretending you're arriving.                                                                                                        |
| M4   | Coverage gate on `src/lib/geo` only                                 | 100% is worth enforcing for the logic that decides when to ring. UI code is covered by component and end-to-end tests instead. The gate also flagged two unreachable branches, which were removed.                  |
| M5   | Synthesise ringtones with Web Audio instead of shipping audio files | No licensing questions, no downloads, nothing extra to cache for offline use, and the tones are original.                                                                                                           |
| M5   | Darker "alarm red" (`#B3121F`) for the full-screen alarm            | White on brand Signal Red is ~3.9:1 contrast; on the darker red it's ~7:1, readable in harsh sunlight on a moving jeepney.                                                                                          |
| M5   | A test alarm starts at full volume; a real alarm builds up over 8 s | A test should sound exactly like the worst case; a real alarm shouldn't be a shock.                                                                                                                                 |
| M5   | Keep a **Test alarm** button in the product                         | Volume can't be set from a web page, so riders need a way to check it before the ride. It also made M5 testable on real phones before the trip flow existed.                                                        |
| M5   | Don't create the AudioContext until a tap                           | Browsers warn about, and suspend, contexts created without a user gesture. Checking support no longer creates one.                                                                                                  |
| M5   | `vibration.stop()` does nothing unless vibration started            | Found by an end-to-end test: React StrictMode's double mount called `vibrate(0)` on page load, which browsers warn about before the first tap.                                                                      |

## Risks and mitigations

| Risk                                  | Mitigation                                                                                                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GPS accuracy (tall buildings, trains) | Show the accuracy halo; ignore inaccurate readings; suggest a bigger radius for rail.                                                                       |
| False alarms                          | 2 consecutive readings inside the radius; reject stale readings; snooze only rings again while still near.                                                  |
| Missing the stop (fast ride, gaps)    | Passed-stop detection; lost-signal warning; 30 s watchdog.                                                                                                  |
| Permission denied                     | Explain first; step-by-step help to unblock; search and the map still work.                                                                                 |
| Screen lock and background throttling | Can't be fixed on the web. Wake lock, clear explainers, a banner on return, and an honest README.                                                           |
| iOS limits                            | No vibration; wake lock needs Safari 16.4+ and was unreliable in home-screen mode before iOS 18.4; no install prompt; the silent switch can mute web audio. |
| Audio unlock                          | Unlock inside the Start tap; preview button; "turn your volume up" hint (web pages can't change system volume).                                             |
| OSM tiles or Nominatim unavailable    | CARTO tiles ready as a one-line switch; Photon as a search fallback.                                                                                        |

## Testing

- **Unit (Vitest):**
  - geometry and formatting;
  - the geocoder (rate limit, cache, back-off, cancellation);
  - location providers;
  - hooks, components and App flows, using a hand-driven fake location provider.
- **End-to-end (Playwright, Pixel 7):**
  - map, search and caching;
  - real-GPS emulation, including moving the phone mid-test;
  - the demo ride;
  - the blocked-permission path.
- **Demo ride:** `?sim=edsa&speed=10` for manual testing on any device, including a real phone, with no travel needed.
- **Real phones:**
  - Android: `adb reverse tcp:5173 tcp:5173` lets the phone use `localhost`, which counts as secure. Debug at `chrome://inspect`.
  - iPhone: use Vercel URLs with Safari Web Inspector on a Mac.
- **Field test (M9):** a real ride with recording turned on. Recorded tracks become test fixtures.

Run everything with: `npm run lint && npm run typecheck && npm run coverage && npm run build && npm run test:e2e` (`coverage` runs the unit tests and enforces 100% on `src/lib/geo`).

## Branding

- **Colours:**
  - Jeep Yellow `#FFB703`
  - Deep Navy `#0B3C5D`
  - Signal Red `#E63946` (alarm only)
  - Route Teal `#2A9D8F`
  - Warm Paper `#FAF7F2`
  - Ink `#1F2933`
  - GPS Blue `#1A73E8` (the "you are here" dot only)
- **Logo:** a navy map pin whose head is a bell, with sound-wave arcs, on a yellow rounded square.
- **Font:** Plus Jakarta Sans, bundled with the app so it works offline.
- **Voice:** friendly and polite, English with light Filipino ("Para po!", "Ingat!").

## Open questions

Defaults are in use until these are answered.

1. What stack is the native version built in? This is needed for the README's native vs web comparison.
2. Ringtones: default is synthesised tones or CC0 sounds, unless you have your own.
3. Default radius: 300 m (range 100 m to 2 km).
4. Public demo ride on the live site: yes.
5. Copy: English with light Filipino until the language toggle exists.
