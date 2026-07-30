# Caleow
Caleow is a website for counting calories, with library of food with calorie value and BMI calculator.

## Stack
Vanilla HTML/CSS/JS. No framework, no build step, no dependencies.
Runs directly in the browser from static files.

## Storage
Everything is client-side `localStorage`, keyed as:
- `caleow_current_items` — today's logged food items (array)
- `caleow_templates` — saved templates (array)
- `caleow_goal` — daily calorie goal (number)
- `caleow_theme` — `"light"` or `"dark"`

No network requests, no backend, no analytics.

## Layout
App-shell pattern: `.app` is a fixed-height (`100dvh`) flex column. `header` and `nav.bottom` are normal flex items that never move; `main` is the only scrolling region (`overflow-y:auto`). This avoids `position:fixed` jank caused by mobile browsers resizing the viewport when their address bar hides/shows during scroll.

## BMI / calorie math
- Standard BMI: `kg / m²`
- New BMI (Oxford): `1.3 × kg / m^2.5`
- Ponderal Index: `kg / m³`
- Daily calorie needs: Mifflin-St Jeor BMR × activity multiplier,
  ±500 kcal for lose/gain targets. Requires age, sex, activity level.

## PWA
`manifest.json` + `service-worker.js` (cache-first for the app shell) make the app installable via "Add to Home screen" in Chrome on Android, and usable offline afterward.
