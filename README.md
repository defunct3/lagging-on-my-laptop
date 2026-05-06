# Lagging-On-My-Laptop

Weather-aware commute routing app for the hackathon.

The project is split into two deployable parts:

```text
lagging-on-my-laptop/
  frontend/   Static website deployed on Vercel
  backend/    Node.js API deployed on AWS Elastic Beanstalk
```

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

## Frontend Deployment

Deploy `frontend/` to Vercel.

In Vercel project settings, set:

```text
Root Directory: frontend
```

`frontend/vercel.json` proxies frontend API calls to the Elastic Beanstalk backend:

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

Frontend code should call the backend with relative URLs:

```js
fetch('/api/commute-routes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    origin: 'SM City Cebu, Cebu City',
    destination: 'Ayala Center Cebu',
    weatherLocation: {
      latitude: 10.3181,
      longitude: 123.9058
    },
    modes: ['DRIVE', 'WALK']
  })
});
```

## Backend Deployment

Deploy `backend/` to AWS Elastic Beanstalk as a Node.js app.

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
GOOGLE_ROUTES_API_KEY=your_google_routes_api_key
CORS_ORIGIN=https://your-vercel-project.vercel.app
```

For early testing, `CORS_ORIGIN=*` is acceptable. For final deployment, use the deployed Vercel URL.

## Backend Endpoints

Health check:

```http
GET /api/health
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
  "weatherLocation": {
    "latitude": 10.3181,
    "longitude": 123.9058
  },
  "modes": ["DRIVE", "WALK"]
}
```

## Notes

- Do not commit `.env` or API keys.
- The Google Routes API key belongs only in Elastic Beanstalk environment properties.
- Open-Meteo does not require an API key for this usage.
- Vercel should call `/api/...`, not the Elastic Beanstalk URL directly.
