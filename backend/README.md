# Weather-Aware Commute Backend

Small Node API for ranking Google Routes results using Open-Meteo weather data.

## Run

```bash
set GOOGLE_ROUTES_API_KEY=your_google_routes_api_key
npm run backend
```

PowerShell:

```powershell
$env:GOOGLE_ROUTES_API_KEY="your_google_routes_api_key"
npm run backend
```

The server runs on `http://127.0.0.1:3001` by default. Set `PORT` to change it.

## Endpoints

### `GET /api/health`

Returns service status and whether the Google Routes API key is configured.

### `POST /api/commute-routes`

Request:

```json
{
  "origin": "SM City Cebu, Cebu City",
  "destination": "University of San Carlos Talamban Campus",
  "weatherLocation": {
    "latitude": 10.3545,
    "longitude": 123.9115
  },
  "departureTime": "2026-05-06T09:00:00+08:00",
  "modes": ["DRIVE", "TRANSIT", "WALK", "BICYCLE", "TWO_WHEELER"]
}
```

`origin` and `destination` can be address strings or coordinate objects:

```json
{ "latitude": 10.3157, "longitude": 123.8854 }
```

Use `weatherLocation` when sending text addresses so the weather lookup has exact coordinates. If omitted, the backend tries to use the route destination coordinates returned by Google.

Response:

```json
{
  "recommendation": {
    "mode": "DRIVE",
    "durationMinutes": 28,
    "distanceKm": 12.4,
    "encodedPolyline": "...",
    "recommendationReason": "Drive matches the weather rule: High precipitation risk. Prefer enclosed vehicles."
  },
  "alternatives": [],
  "weather": {
    "apparentTemperatureC": 33.1,
    "precipitationProbability": 72
  },
  "policy": {
    "condition": "HIGH_PRECIPITATION",
    "preferredModes": ["DRIVE", "TRANSIT"],
    "message": "High precipitation risk. Prefer enclosed vehicles."
  }
}
```

## Weather Rules

- Precipitation probability >= 55% or active precipitation: prefer enclosed vehicles.
- Apparent temperature >= 32C: prefer air-conditioned or enclosed vehicles.
- Otherwise: rank by fastest efficient route.

The API key stays in the backend environment and is never sent to the frontend.
