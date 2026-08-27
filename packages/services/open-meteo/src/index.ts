// Open-Meteo is free, keyless, and non-commercial-use friendly (up to
// 10,000 calls/day) with up to 16 days of daily forecast - no account, no
// API key to manage. It only takes lat/lon, so zip/city inputs are resolved
// first via free, keyless geocoders (Zippopotam for US zips, Open-Meteo's
// own geocoder for free-text city/state search).
const ZIP_RE = /^\d{5}(-\d{4})?$/;

const US_STATE_ABBR: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "District of Columbia",
};

interface Geocode {
  lat: number;
  lon: number;
  label: string;
  // Only set for US locations - used to link out to Wunderground's forecast
  // page, which is keyed by state abbreviation + city slug.
  city: string;
  stateAbbr: string | null;
}

const STATE_NAME_TO_ABBR: Record<string, string> = Object.fromEntries(
  Object.entries(US_STATE_ABBR).map(([abbr, name]) => [name.toLowerCase(), abbr]),
);

function slugify(text: string): string {
  // Keep the place name's own letters (accents included) rather than
  // transliterating them - Wunderground's real slugs percent-encode the
  // UTF-8 city name as-is (e.g. "Canon City" with a tilde-n becomes
  // "ca%C3%B1on-city"), they don't strip the accent down to a plain "n".
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "");
  return encodeURIComponent(slug);
}

function wundergroundCityBase(city: string, stateAbbr: string, zip: string | null): string {
  const base = `https://www.wunderground.com/forecast/us/${stateAbbr.toLowerCase()}/${slugify(city)}`;
  return zip ? `${base}/${zip}` : base;
}

function wundergroundForecastUrl(city: string, stateAbbr: string | null, zip: string | null): string | null {
  if (!stateAbbr) return null;
  return wundergroundCityBase(city, stateAbbr, zip);
}

function wundergroundHourlyUrl(
  city: string,
  stateAbbr: string | null,
  zip: string | null,
  date: string,
): string | null {
  if (!stateAbbr) return null;
  // The city base doubles as the hourly base too - Wunderground swaps
  // "forecast" for "hourly" and appends a specific date at the end.
  const base = wundergroundCityBase(city, stateAbbr, zip).replace("/forecast/", "/hourly/");
  return `${base}/date/${date}`;
}

async function resolveZip(zip: string): Promise<Geocode> {
  const response = await fetch(`https://api.zippopotam.us/us/${zip}`);
  if (!response.ok) throw new Error(`No location found for zip code "${zip}"`);

  const data = (await response.json()) as {
    places?: { latitude: string; longitude: string; "place name": string; "state abbreviation": string }[];
  };
  const place = data.places?.[0];
  if (!place) throw new Error(`No location found for zip code "${zip}"`);

  return {
    lat: parseFloat(place.latitude),
    lon: parseFloat(place.longitude),
    label: `${place["place name"]}, ${place["state abbreviation"]}`,
    city: place["place name"],
    stateAbbr: place["state abbreviation"],
  };
}

function splitCityState(query: string): { name: string; state: string | null } {
  const commaIndex = query.indexOf(",");
  if (commaIndex === -1) return { name: query, state: null };
  return { name: query.slice(0, commaIndex).trim(), state: query.slice(commaIndex + 1).trim() };
}

function stateMatches(admin1: string | undefined, state: string): boolean {
  if (!admin1) return false;
  const normalized = admin1.toLowerCase();
  if (normalized === state.toLowerCase()) return true;
  const fullName = US_STATE_ABBR[state.toUpperCase()];
  return fullName != null && normalized === fullName.toLowerCase();
}

interface GeoResult {
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
  feature_code?: string;
  country_code?: string;
}

async function resolveSearch(query: string): Promise<Geocode> {
  const { name, state } = splitCityState(query);

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.search = new URLSearchParams({
    name,
    count: "20",
    language: "en",
    format: "json",
  }).toString();

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Location search failed: HTTP ${response.status}`);

  const data = (await response.json()) as { results?: GeoResult[] };
  const results = data.results ?? [];
  if (results.length === 0) throw new Error(`No location found for "${query}"`);

  // A state was given but nothing returned actually matches it - do NOT
  // silently fall back to an unfiltered (wrong-state) match here, that's how
  // "Pine, CO" quietly resolved to Loomis, CA: the geocoder has no "Pine"
  // entry in Colorado at all (the real place is indexed as "Pine Junction"),
  // so the unfiltered top hit was some unrelated same-named town elsewhere.
  if (state && !results.some((result) => stateMatches(result.admin1, state))) {
    throw new Error(`No location found for "${name}" in "${state}" - try a zip code instead`);
  }

  const pool = state ? results.filter((result) => stateMatches(result.admin1, state)) : results;
  const best = pool.find((result) => result.feature_code?.startsWith("PPL")) ?? pool[0];

  const stateAbbr =
    best.country_code === "US" && best.admin1
      ? (STATE_NAME_TO_ABBR[best.admin1.toLowerCase()] ?? null)
      : null;

  return {
    lat: best.latitude,
    lon: best.longitude,
    label: [best.name, best.admin1].filter(Boolean).join(", "),
    city: best.name,
    stateAbbr,
  };
}

async function resolveLocation(input: string): Promise<Geocode> {
  const trimmed = input.trim();
  return ZIP_RE.test(trimmed) ? resolveZip(trimmed) : resolveSearch(trimmed);
}

export interface DailyForecastDay {
  date: string; // "YYYY-MM-DD", in the forecast location's own local calendar
  weatherCode: number; // WMO weather interpretation code
  temperatureMax: number;
  temperatureMin: number;
  precipitationChance: number; // percent, 0-100
  precipitationAmount: number; // inches
  windSpeedMax: number; // mph
  hourlyUrl: string | null;
}

export interface WeatherForecast {
  location: string;
  wundergroundUrl: string | null;
  days: DailyForecastDay[];
}

interface RawDailyForecast {
  time: string[];
  weathercode: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_probability_max: number[];
  precipitation_sum: number[];
  windspeed_10m_max: number[];
}

export async function getForecast(locationInput: string): Promise<WeatherForecast> {
  const trimmed = locationInput.trim();
  const zip = ZIP_RE.test(trimmed) ? trimmed.slice(0, 5) : null;
  const geocode = await resolveLocation(trimmed);

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(geocode.lat),
    longitude: String(geocode.lon),
    daily: [
      "weathercode",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "precipitation_sum",
      "windspeed_10m_max",
    ].join(","),
    temperature_unit: "fahrenheit",
    windspeed_unit: "mph",
    precipitation_unit: "inch",
    timezone: "auto",
    forecast_days: "10",
  }).toString();

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Forecast request failed: HTTP ${response.status}`);

  const data = (await response.json()) as { daily: RawDailyForecast };
  const days: DailyForecastDay[] = data.daily.time.map((date, i) => ({
    date,
    weatherCode: data.daily.weathercode[i],
    temperatureMax: data.daily.temperature_2m_max[i],
    temperatureMin: data.daily.temperature_2m_min[i],
    precipitationChance: data.daily.precipitation_probability_max[i],
    precipitationAmount: data.daily.precipitation_sum[i],
    windSpeedMax: data.daily.windspeed_10m_max[i],
    hourlyUrl: wundergroundHourlyUrl(geocode.city, geocode.stateAbbr, zip, date),
  }));

  return {
    location: geocode.label,
    wundergroundUrl: wundergroundForecastUrl(geocode.city, geocode.stateAbbr, zip),
    days,
  };
}
