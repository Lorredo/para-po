# Recorded rides

Real trips recorded with Para Po's ride recorder (Alarm settings › "Save a GPS
log of my next trip"). Each file here is replayed by
`src/lib/geo/rideFixtures.test.ts` on every test run:

- **Regression:** today's geofence must make the same decisions the app made
  on the real ride (same readings ring, as `arrived` or `passed`).
- **Optional expectation:** add an `"expect"` block to pin the outcome you
  wanted, for example after tuning thresholds:

  ```json
  "expect": { "event": "arrived", "maxDistanceM": 320 }
  ```

Before committing a ride, check you're comfortable publishing it: it's a
precise GPS trace of a real journey. Trim the start of the ride if it begins
at home or work.

Name files `YYYY-MM-DD-<mode>-<from>-to-<to>.json`, for example
`2026-12-01-jeepney-cubao-to-ayala.json`.
