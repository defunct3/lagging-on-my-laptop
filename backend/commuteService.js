const GOOGLE_ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

const DEFAULT_MODES = ['DRIVE', 'TRANSIT', 'WALK', 'BICYCLE', 'TWO_WHEELER'];
const ENCLOSED_MODES = new Set(['DRIVE', 'TRANSIT']);
const AIR_CONDITIONED_MODES = new Set(['DRIVE', 'TRANSIT']);
const EXPOSED_MODES = new Set(['WALK', 'BICYCLE', 'TWO_WHEELER']);

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function recommendCommuteRoute(request, config) {
  validateCommuteRequest(request);

  const modes = normalizeModes(request.modes);
  const departureTime = request.departureTime ?? new Date().toISOString();
  const initialWeatherPoint = getWeatherPointFromRequest(request);

  const firstPassRoutes = await fetchRoutesForModes({
    apiKey: config.googleRoutesApiKey,
    origin: request.origin,
    destination: request.destination,
    departureTime,
    modes,
  });

  const weatherPoint =
    initialWeatherPoint ??
    getWeatherPointFromRoutes(firstPassRoutes) ??
    fail(400, 'Provide weatherLocation when using text addresses and Google does not return destination coordinates.');

  const weather = await fetchWeather(weatherPoint);
  const policy = chooseWeatherPolicy(weather);
  const rankedRoutes = rankRoutes(firstPassRoutes, weather, policy);

  return {
    recommendation: rankedRoutes[0] ?? null,
    alternatives: rankedRoutes.slice(1),
    weather,
    policy,
    requestedAt: new Date().toISOString(),
  };
}

function validateCommuteRequest(request) {
  if (!request || typeof request !== 'object') {
    fail(400, 'Request body must be a JSON object.');
  }

  if (!request.origin || !request.destination) {
    fail(400, 'Both origin and destination are required.');
  }
}

function normalizeModes(modes) {
  if (!Array.isArray(modes) || modes.length === 0) {
    return DEFAULT_MODES;
  }

  const allowed = new Set(DEFAULT_MODES);
  const normalized = modes.map((mode) => String(mode).toUpperCase()).filter((mode) => allowed.has(mode));

  if (normalized.length === 0) {
    fail(400, `modes must include at least one of: ${DEFAULT_MODES.join(', ')}.`);
  }

  return [...new Set(normalized)];
}

function getWeatherPointFromRequest(request) {
  if (isLatLng(request.weatherLocation)) return toLatLng(request.weatherLocation);
  if (isLatLng(request.destination)) return toLatLng(request.destination);
  return null;
}

function getWeatherPointFromRoutes(routes) {
  for (const route of routes) {
    const location = route.raw?.legs?.at(-1)?.endLocation?.latLng;
    if (isLatLng(location)) return toLatLng(location);
  }

  return null;
}

async function fetchRoutesForModes({ apiKey, origin, destination, departureTime, modes }) {
  if (!apiKey) {
    fail(500, 'GOOGLE_ROUTES_API_KEY is not configured.');
  }

  const routeResults = await Promise.allSettled(
    modes.map((mode) => fetchGoogleRoute({ apiKey, origin, destination, departureTime, mode })),
  );

  const routes = routeResults
    .filter((result) => result.status === 'fulfilled' && result.value)
    .map((result) => result.value);

  if (routes.length === 0) {
    const failures = routeResults
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason?.message ?? String(result.reason));
    fail(502, 'No routes could be computed.', failures);
  }

  return routes;
}

async function fetchGoogleRoute({ apiKey, origin, destination, departureTime, mode }) {
  const body = {
    origin: { waypoint: toGoogleWaypoint(origin) },
    destination: { waypoint: toGoogleWaypoint(destination) },
    travelMode: mode,
    computeAlternativeRoutes: true,
    departureTime,
    languageCode: 'en-US',
    units: 'METRIC',
  };

  if (mode === 'DRIVE' || mode === 'TWO_WHEELER') {
    body.routingPreference = 'TRAFFIC_AWARE_OPTIMAL';
  }

  const response = await fetch(GOOGLE_ROUTES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': [
        'routes.duration',
        'routes.distanceMeters',
        'routes.description',
        'routes.legs.startLocation',
        'routes.legs.endLocation',
        'routes.polyline.encodedPolyline',
        'routes.travelAdvisory',
      ].join(','),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${mode} route failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  const route = payload.routes?.[0];
  if (!route) return null;

  return normalizeRoute(route, mode);
}

function normalizeRoute(route, mode) {
  const durationSeconds = parseDurationSeconds(route.duration);

  return {
    mode,
    summary: route.description ?? modeLabel(mode),
    durationSeconds,
    durationMinutes: Math.round(durationSeconds / 60),
    distanceMeters: route.distanceMeters ?? null,
    distanceKm: route.distanceMeters ? Number((route.distanceMeters / 1000).toFixed(2)) : null,
    encodedPolyline: route.polyline?.encodedPolyline ?? null,
    raw: route,
  };
}

async function fetchWeather({ latitude, longitude }) {
  const url = new URL(OPEN_METEO_URL);
  url.searchParams.set('latitude', latitude);
  url.searchParams.set('longitude', longitude);
  url.searchParams.set('current', 'temperature_2m,apparent_temperature,precipitation,weather_code');
  url.searchParams.set('hourly', 'precipitation_probability,apparent_temperature');
  url.searchParams.set('forecast_days', '1');
  url.searchParams.set('timezone', 'auto');

  const response = await fetch(url);
  if (!response.ok) {
    fail(502, `Open-Meteo request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const currentHourIndex = nearestHourIndex(payload.hourly?.time, payload.current?.time);
  const precipitationProbability = payload.hourly?.precipitation_probability?.[currentHourIndex] ?? 0;
  const hourlyApparentTemperature = payload.hourly?.apparent_temperature?.[currentHourIndex];

  return {
    latitude: payload.latitude,
    longitude: payload.longitude,
    timezone: payload.timezone,
    observedAt: payload.current?.time ?? null,
    temperatureC: payload.current?.temperature_2m ?? null,
    apparentTemperatureC: payload.current?.apparent_temperature ?? hourlyApparentTemperature ?? null,
    precipitationMm: payload.current?.precipitation ?? 0,
    precipitationProbability,
    weatherCode: payload.current?.weather_code ?? null,
  };
}

function chooseWeatherPolicy(weather) {
  const rainRisk = Number(weather.precipitationProbability ?? 0);
  const feelsLike = Number(weather.apparentTemperatureC ?? 0);

  if (rainRisk >= 55 || Number(weather.precipitationMm ?? 0) > 0) {
    return {
      condition: 'HIGH_PRECIPITATION',
      preferredModes: [...ENCLOSED_MODES],
      message: 'High precipitation risk. Prefer enclosed vehicles.',
    };
  }

  if (feelsLike >= 32) {
    return {
      condition: 'HIGH_HEAT_INDEX',
      preferredModes: [...AIR_CONDITIONED_MODES],
      message: 'High heat index. Prefer air-conditioned or enclosed vehicles.',
    };
  }

  return {
    condition: 'NORMAL',
    preferredModes: DEFAULT_MODES,
    message: 'Weather is acceptable. Prefer the fastest efficient route.',
  };
}

function rankRoutes(routes, weather, policy) {
  return routes
    .map((route) => {
      const weatherPenalty = getWeatherPenalty(route.mode, weather, policy);
      const score = route.durationSeconds + weatherPenalty;

      return {
        ...route,
        score,
        recommendationReason: buildRecommendationReason(route, weather, policy, weatherPenalty),
      };
    })
    .sort((a, b) => a.score - b.score);
}

function getWeatherPenalty(mode, weather, policy) {
  if (policy.condition === 'NORMAL') return 0;

  if (policy.condition === 'HIGH_PRECIPITATION' && !ENCLOSED_MODES.has(mode)) {
    return 30 * 60 + Number(weather.precipitationProbability ?? 0) * 20;
  }

  if (policy.condition === 'HIGH_HEAT_INDEX' && EXPOSED_MODES.has(mode)) {
    return 25 * 60 + Math.max(0, Number(weather.apparentTemperatureC ?? 32) - 32) * 120;
  }

  return 0;
}

function buildRecommendationReason(route, weather, policy, weatherPenalty) {
  if (weatherPenalty === 0 && policy.condition !== 'NORMAL') {
    return `${modeLabel(route.mode)} matches the weather rule: ${policy.message}`;
  }

  if (weatherPenalty > 0) {
    return `${modeLabel(route.mode)} is less preferred because of current weather: ${policy.message}`;
  }

  return `${modeLabel(route.mode)} is ranked by travel time and distance.`;
}

function toGoogleWaypoint(value) {
  if (typeof value === 'string') {
    return { address: value };
  }

  if (isLatLng(value)) {
    const { latitude, longitude } = toLatLng(value);
    return { location: { latLng: { latitude, longitude } } };
  }

  fail(400, 'Locations must be address strings or { latitude, longitude } objects.');
}

function toLatLng(value) {
  return {
    latitude: Number(value.latitude ?? value.lat),
    longitude: Number(value.longitude ?? value.lng),
  };
}

function isLatLng(value) {
  if (!value || typeof value !== 'object') return false;
  const latitude = Number(value.latitude ?? value.lat);
  const longitude = Number(value.longitude ?? value.lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude);
}

function parseDurationSeconds(duration) {
  if (typeof duration !== 'string') return 0;
  return Number(duration.replace('s', '')) || 0;
}

function nearestHourIndex(times = [], currentTime) {
  if (!Array.isArray(times) || times.length === 0 || !currentTime) return 0;

  const target = new Date(currentTime).getTime();
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  times.forEach((time, index) => {
    const distance = Math.abs(new Date(time).getTime() - target);
    if (distance < bestDistance) {
      bestIndex = index;
      bestDistance = distance;
    }
  });

  return bestIndex;
}

function modeLabel(mode) {
  return mode
    .toLowerCase()
    .replace('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function fail(status, message, details) {
  throw new ApiError(status, message, details);
}
