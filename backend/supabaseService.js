import { ApiError } from './commuteService.js';

export function isSupabaseConfigured(config) {
  return Boolean(config.supabaseUrl && config.supabaseServiceRoleKey);
}

export async function saveTripPlan(plan, config) {
  ensureSupabase(config);

  if (!plan || typeof plan !== 'object') {
    throw new ApiError(400, 'Trip plan body must be a JSON object.');
  }

  if (!plan.origin || !plan.destination || !plan.recommendation) {
    throw new ApiError(400, 'origin, destination, and recommendation are required.');
  }

  const payload = {
    origin: String(plan.origin),
    destination: String(plan.destination),
    modes: Array.isArray(plan.modes) ? plan.modes.map(String) : [],
    recommendation: plan.recommendation,
    alternatives: Array.isArray(plan.alternatives) ? plan.alternatives : [],
    weather: plan.weather ?? null,
    policy: plan.policy ?? null,
    metadata: plan.metadata ?? {},
  };

  const response = await supabaseFetch(config, '/rest/v1/trip_plans', {
    method: 'POST',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  });

  return response[0] ?? null;
}

export async function listTripPlans(config, limit = 20) {
  ensureSupabase(config);

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  return supabaseFetch(config, `/rest/v1/trip_plans?select=*&order=created_at.desc&limit=${safeLimit}`);
}

async function supabaseFetch(config, path, options = {}) {
  const response = await fetch(`${getSupabaseBaseUrl(config.supabaseUrl)}${path}`, {
    ...options,
    headers: {
      apikey: config.supabaseServiceRoleKey,
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new ApiError(502, `Supabase request failed with status ${response.status}.`, message);
  }

  return response.status === 204 ? null : response.json();
}

function ensureSupabase(config) {
  if (!isSupabaseConfigured(config)) {
    throw new ApiError(500, 'Supabase is not configured.');
  }
}

function getSupabaseBaseUrl(url) {
  return String(url)
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1$/i, '');
}
