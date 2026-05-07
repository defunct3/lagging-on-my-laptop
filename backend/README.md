# Weather-Aware Commute Backend

Node.js API for ranking Google Routes results with Open-Meteo weather data.

## Run Locally

PowerShell:

```powershell
$env:GOOGLE_ROUTES_API_KEY="your_server_routes_key"
$env:GOOGLE_MAPS_BROWSER_API_KEY="your_browser_maps_key"
$env:SUPABASE_URL="your_supabase_project_url"
$env:SUPABASE_SERVICE_ROLE_KEY="your_supabase_service_role_key"
$env:CORS_ORIGIN="*"
npm start
```

The server runs on:

```text
http://127.0.0.1:3001
```

Set `PORT` to change the port.

## Environment Variables

```env
GOOGLE_ROUTES_API_KEY=server key restricted to Routes API
GOOGLE_MAPS_BROWSER_API_KEY=browser key restricted to Maps JavaScript API and Places API
SUPABASE_URL=Supabase project URL
SUPABASE_SERVICE_ROLE_KEY=Supabase service role key
CORS_ORIGIN=https://devweek2026-git-main-priensmaggis-projects.vercel.app
```

## Endpoints

### `GET /api/health`

Returns service status and key configuration flags.

### `GET /api/maps-key`

Returns the browser-safe Google Maps key for loading Google Maps JavaScript on the frontend.

### `POST /api/commute-routes`

Request:

```json
{
  "origin": "SM City Cebu, Cebu City",
  "destination": "Ayala Center Cebu",
  "modes": ["DRIVE", "TRANSIT", "WALK", "BICYCLE", "TWO_WHEELER"]
}
```

Optional:

```json
{
  "weatherLocation": {
    "latitude": 10.3181,
    "longitude": 123.9058
  },
  "departureTime": "2026-05-06T20:00:00+08:00"
}
```

`origin` and `destination` can be address strings or coordinate objects:

```json
{ "latitude": 10.3157, "longitude": 123.8854 }
```

Response includes:

```json
{
  "recommendation": {
    "mode": "DRIVE",
    "durationMinutes": 10,
    "distanceKm": 2.33,
    "encodedPolyline": "...",
    "recommendationReason": "Drive matches the weather rule: High heat index. Prefer air-conditioned or enclosed vehicles."
  },
  "alternatives": [],
  "weather": {
    "apparentTemperatureC": 32.9,
    "precipitationProbability": 1
  },
  "policy": {
    "condition": "HIGH_HEAT_INDEX",
    "heatIndex": {
      "category": "EXTREME_CAUTION",
      "label": "Extreme Caution",
      "rangeC": "33-41"
    },
    "preferredModes": ["DRIVE", "TRANSIT"],
    "message": "PAGASA Extreme Caution heat index (33C). Heat cramps and heat exhaustion are possible with continued activity. Prefer air-conditioned or enclosed vehicles."
  }
}
```

### `GET /api/trip-plans`

Returns recent saved trip plans from Supabase.

```http
GET /api/trip-plans?limit=20
```

### `POST /api/trip-plans`

Saves a trip plan to Supabase.

```json
{
  "origin": "SM City Cebu, Cebu City",
  "destination": "Ayala Center Cebu",
  "modes": ["DRIVE", "WALK"],
  "recommendation": {},
  "alternatives": [],
  "weather": {},
  "policy": {}
}
```

## Supabase Table

Create this table in the Supabase SQL editor:

```sql
create table if not exists public.trip_plans (
  id uuid primary key default gen_random_uuid(),
  origin text not null,
  destination text not null,
  modes text[] not null default '{}',
  recommendation jsonb not null,
  alternatives jsonb not null default '[]'::jsonb,
  weather jsonb,
  policy jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

The backend uses the Supabase service role key, so do not expose that key in frontend code.

## Weather Rules

- Precipitation probability >= 55% or active precipitation: prefer enclosed vehicles.
- PAGASA Caution heat index, 27-32C: report caution, but still rank by fastest efficient route.
- PAGASA Extreme Caution heat index, 33-41C: prefer air-conditioned or enclosed vehicles.
- PAGASA Danger heat index, 42-51C: strongly prefer air-conditioned or enclosed vehicles.
- PAGASA Extreme Danger heat index, 52C and above: heavily penalize exposed modes and prefer air-conditioned or enclosed vehicles.
- Otherwise: rank by fastest efficient route.

References:

- PAGASA Heat Index: https://www.pagasa.dost.gov.ph/weather/heat-index
- PAGASA heat index monitoring system statement: https://bagong.pagasa.dost.gov.ph/press-release/155

## Deployment

Upload the contents of this `backend/` folder to Elastic Beanstalk as a Node.js app.

Elastic Beanstalk starts the app with:

```bash
npm start
```
