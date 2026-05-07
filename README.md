git add README.md backend/README.md backend/commuteService.js frontend/script.js# Lagging-On-My-Laptop

Weather-aware commute routing app for Dev Week 2026.

## What Is This?

RouteCast helps commuters choose a better route based on both travel time and current weather conditions.

Users enter a starting location, destination, and preferred travel modes. The app checks route options with Google Routes and checks local weather with Open-Meteo. If rain risk is high, it prefers enclosed vehicles. If the heat index reaches PAGASA Extreme Caution, Danger, or Extreme Danger, it prefers air-conditioned or enclosed transport. Otherwise, it recommends the fastest efficient route.

This project is for daily commuters, students, workers, and hackathon users who want route suggestions that react to practical weather conditions, not just distance and time.

## How Do I Use It?

Open the deployed frontend:

```text
https://devweek2026-git-main-priensmaggis-projects.vercel.app
```

Then:

1. Click **Get Started** or **Calculate my best route**.
2. Enter your starting location.
3. Enter your destination.
4. Select the travel modes you want to compare.
5. Click **Get Route**.

The app will show the recommended route, weather-based reason, travel time, distance, and alternatives when available.

## How Do I Run It Locally?

Clone the repository:

```bash
git clone https://github.com/defunct3/lagging-on-my-laptop.git
cd lagging-on-my-laptop
```

Run the backend:

```powershell
cd backend
$env:GOOGLE_ROUTES_API_KEY="your_server_routes_key"
$env:GOOGLE_MAPS_BROWSER_API_KEY="your_browser_maps_key"
$env:CORS_ORIGIN="*"
npm start
```

The backend runs at:

```text
http://127.0.0.1:3001
```

Run the frontend locally by opening this file in a browser:

```text
frontend/index.html
```

For local frontend-to-backend API calls, either deploy through Vercel rewrites or temporarily set the frontend `API_BASE_URL` in `frontend/script.js` to:

```js
const API_BASE_URL = 'http://127.0.0.1:3001';
```

Before committing, change it back to:

```js
const API_BASE_URL = '';
```

The app has two deployable parts:

```text
lagging-on-my-laptop/
  frontend/   Static website deployed on Vercel
  backend/    Node.js API deployed on AWS Elastic Beanstalk
```

## Current Services

Frontend:

```text
https://devweek2026-git-main-priensmaggis-projects.vercel.app
```

Backend:

```text
http://commute-backend-env.eba-wp2aijm3.us-east-1.elasticbeanstalk.com
```

The frontend should call backend endpoints through relative `/api/...` URLs. Vercel rewrites those requests to Elastic Beanstalk.

## Directory Layout

```text
frontend/
  index.html
  script.js
  styles.css
  vercel.json

backend/
  server.js
  commuteService.js
  package.json
  Procfile
  .ebignore
  README.md
```

There is also a root `vercel.json` fallback for deployments that use the repository root instead of `frontend/`.

## Frontend Deployment

Preferred Vercel setting:

```text
Root Directory: frontend
Framework Preset: Other
Build Command: empty
Output Directory: empty or .
```

`frontend/vercel.json` proxies API calls:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "http://commute-backend-env.eba-wp2aijm3.us-east-1.elasticbeanstalk.com/api/:path*"
    }
  ]
}
```

Frontend code should call:

```js
fetch('/api/commute-routes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    origin: 'SM City Cebu, Cebu City',
    destination: 'Ayala Center Cebu',
    modes: ['DRIVE', 'WALK']
  })
});
```

Do not call the Elastic Beanstalk URL directly from browser code. Use `/api/...` so Vercel can proxy the request and avoid mixed-content issues.

## Backend Deployment

Deploy the contents of `backend/` to AWS Elastic Beanstalk as a Node.js app.

Elastic Beanstalk uses:

```text
backend/package.json
backend/Procfile
```

The backend starts with:

```bash
npm start
```

Required Elastic Beanstalk environment properties:

```env
GOOGLE_ROUTES_API_KEY=your_server_routes_key
GOOGLE_MAPS_BROWSER_API_KEY=your_browser_maps_key
CORS_ORIGIN=https://devweek2026-git-main-priensmaggis-projects.vercel.app
```

For early testing only, `CORS_ORIGIN=*` is acceptable.

## Google Cloud Setup

Use two API keys in the same Google Cloud project.

Backend key:

```text
Name: Backend Routes Key
Used as: GOOGLE_ROUTES_API_KEY
Application restriction: None, or server IP if stable
API restrictions: Routes API
```

Browser map key:

```text
Name: Browser Maps Key
Used as: GOOGLE_MAPS_BROWSER_API_KEY
Application restriction: Websites
Allowed website: https://devweek2026-git-main-priensmaggis-projects.vercel.app/*
API restrictions: Maps JavaScript API, Places API
```

The browser Maps key is returned by `GET /api/maps-key` so the frontend can load Google Maps JavaScript. The Routes key must never be exposed to frontend code.

## Backend Endpoints

Health check:

```http
GET /api/health
```

Expected:

```json
{
  "ok": true,
  "service": "weather-aware-commute-api",
  "googleRoutesConfigured": true,
  "googleMapsBrowserConfigured": true
}
```

Browser map key:

```http
GET /api/maps-key
```

Route recommendation:

```http
POST /api/commute-routes
Content-Type: application/json
```

Example body:

```json
{
  "origin": "SM City Cebu, Cebu City",
  "destination": "Ayala Center Cebu",
  "modes": ["DRIVE", "WALK"]
}
```

Optional exact weather location:

```json
{
  "weatherLocation": {
    "latitude": 10.3181,
    "longitude": 123.9058
  }
}
```

## Notes

- Do not commit `.env` or API keys.
- Heat index classification follows PAGASA levels: Caution (27-32C), Extreme Caution (33-41C), Danger (42-51C), and Extreme Danger (52C and above).
- Open-Meteo does not require an API key for this usage.
- If Google Maps says the page did not load correctly, check the Browser Maps Key website restrictions and enabled APIs.
- If route recommendations fail, check the backend JSON error details from `POST /api/commute-routes`.

## References

- PAGASA Heat Index: https://www.pagasa.dost.gov.ph/weather/heat-index
- PAGASA heat index monitoring system statement: https://bagong.pagasa.dost.gov.ph/press-release/155
