import { useEffect, useState } from "react";
import type { WeatherForecast } from "@productivityhub/open-meteo";
import { getCached, setCached } from "../cache";
import type { ModuleProps } from "./types";

function cacheKey(location: string): string {
  return `weather-${location}`;
}

// Parsed as separate y/m/d components (not via Date.parse on the ISO
// string) so the calendar date shown always matches the forecast's own
// day, regardless of the viewer's local timezone offset.
function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatWeekday(dateStr: string): string {
  return parseDateOnly(dateStr).toLocaleDateString(undefined, { weekday: "short" });
}

function formatDate(dateStr: string): string {
  return parseDateOnly(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Standard WMO weather interpretation codes used by Open-Meteo.
const WEATHER_CODES: Record<number, { icon: string; phrase: string }> = {
  0: { icon: "☀️", phrase: "Clear" },
  1: { icon: "🌤️", phrase: "Mainly Clear" },
  2: { icon: "⛅", phrase: "Partly Cloudy" },
  3: { icon: "☁️", phrase: "Overcast" },
  45: { icon: "🌫️", phrase: "Fog" },
  48: { icon: "🌫️", phrase: "Rime Fog" },
  51: { icon: "🌦️", phrase: "Light Drizzle" },
  53: { icon: "🌦️", phrase: "Drizzle" },
  55: { icon: "🌧️", phrase: "Dense Drizzle" },
  56: { icon: "🌧️", phrase: "Freezing Drizzle" },
  57: { icon: "🌧️", phrase: "Freezing Drizzle" },
  61: { icon: "🌦️", phrase: "Light Rain" },
  63: { icon: "🌧️", phrase: "Rain" },
  65: { icon: "🌧️", phrase: "Heavy Rain" },
  66: { icon: "🌨️", phrase: "Freezing Rain" },
  67: { icon: "🌨️", phrase: "Freezing Rain" },
  71: { icon: "🌨️", phrase: "Light Snow" },
  73: { icon: "❄️", phrase: "Snow" },
  75: { icon: "❄️", phrase: "Heavy Snow" },
  77: { icon: "🌨️", phrase: "Snow Grains" },
  80: { icon: "🌦️", phrase: "Rain Showers" },
  81: { icon: "🌧️", phrase: "Rain Showers" },
  82: { icon: "⛈️", phrase: "Heavy Showers" },
  85: { icon: "🌨️", phrase: "Snow Showers" },
  86: { icon: "🌨️", phrase: "Snow Showers" },
  95: { icon: "⛈️", phrase: "Thunderstorm" },
  96: { icon: "⛈️", phrase: "Thunderstorm" },
  99: { icon: "⛈️", phrase: "Severe Thunderstorm" },
};

function describeWeather(code: number): { icon: string; phrase: string } {
  return WEATHER_CODES[code] ?? { icon: "🌡️", phrase: "—" };
}

export function WeatherModule({
  moduleId,
  lockLayout,
  refreshIntervalsMinutes,
  onTitleUrlChange,
}: ModuleProps) {
  const refreshIntervalMs = refreshIntervalsMinutes.weather * 60_000;
  const [location, setLocation] = useState("");
  const [draftLocation, setDraftLocation] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.api.getWeatherLocation(moduleId).then((saved) => {
      setLocation(saved);
      setDraftLocation(saved);
      setForecast(saved ? (getCached<WeatherForecast>(cacheKey(saved)) ?? null) : null);
      setLoaded(true);
    });
  }, [moduleId]);

  useEffect(() => {
    if (lockLayout) setDraftLocation(location);
  }, [lockLayout, location]);

  useEffect(() => {
    if (!location) return;

    let cancelled = false;

    function fetchForecast(): void {
      window.api
        .getWeatherForecast(location)
        .then((result) => {
          if (cancelled) return;
          setForecast(result);
          setCached(cacheKey(location), result, refreshIntervalMs);
          setError(null);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : String(err));
        });
    }

    fetchForecast();
    const interval = setInterval(fetchForecast, refreshIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [location, refreshIntervalMs]);

  useEffect(() => {
    // Deliberately not depending on onTitleUrlChange itself - it's a fresh
    // closure every WorkspaceView render, and re-firing only when the
    // actual link target changes avoids feedback-looping into re-renders.
    onTitleUrlChange?.(forecast?.wundergroundUrl ?? null);
    return () => onTitleUrlChange?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forecast?.wundergroundUrl]);

  function commitLocation(): void {
    const normalized = draftLocation.trim();
    if (!normalized) return;
    setLocation(normalized);
    setForecast(getCached<WeatherForecast>(cacheKey(normalized)) ?? null);
    setError(null);
    window.api.saveWeatherLocation(moduleId, normalized);
  }

  if (!loaded) {
    return <p>Loading…</p>;
  }

  return (
    <div className="weather-module">
      {!lockLayout && (
        <div className="weather-form">
          <input
            className="weather-location-input"
            value={draftLocation}
            placeholder="Zip code or 'City, State'"
            onChange={(event) => setDraftLocation(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitLocation();
            }}
          />
          <button onClick={commitLocation}>Set</button>
        </div>
      )}

      {!location ? (
        <p className="module-placeholder">Enter a zip code or "City, State" above.</p>
      ) : error ? (
        <p className="module-error">Error: {error}</p>
      ) : !forecast ? (
        <p>Loading forecast…</p>
      ) : (
        <>
          {forecast.wundergroundUrl ? (
            <a
              className="weather-location-label weather-location-link"
              href={forecast.wundergroundUrl}
              target="_blank"
              rel="noreferrer"
            >
              {forecast.location}
            </a>
          ) : (
            <p className="weather-location-label">{forecast.location}</p>
          )}
          <div className="weather-columns">
            {forecast.days.map((day) => {
              const { icon, phrase } = describeWeather(day.weatherCode);

              return (
                <div key={day.date} className="weather-column">
                  <div className="weather-column-heading">
                    {formatWeekday(day.date)} {formatDate(day.date)}
                  </div>
                  <span className="weather-column-icon" title={phrase}>
                    {icon}
                  </span>
                  <div className="weather-column-temps">
                    {Math.round(day.temperatureMax)}° / {Math.round(day.temperatureMin)}°
                  </div>
                  <div className="weather-column-phrase">{phrase}</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
