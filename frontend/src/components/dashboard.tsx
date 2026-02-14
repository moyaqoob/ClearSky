import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchCurrent,
  fetchHistory,
  fetchLocationSearch,
  fetchRecommendation,
  fetchTips,
  type AqiCurrent,
  type GeocodeResult,
  type HistoryDay,
  type HistoryResponse,
  type Recommendation,
  type TipsResponse,
} from "../api/client";
import "./Dashboard.css";

const DEFAULT_LAT = 40.0;
const DEFAULT_LNG = -74.006;
const SEARCH_DEBOUNCE_MS = 350;

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aqi, setAqi] = useState<AqiCurrent | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(
    null
  );
  const [historyData, setHistoryData] = useState<HistoryResponse | null>(null);
  const [tips, setTips] = useState<TipsResponse | null>(null);
  const [lat, setLat] = useState(DEFAULT_LAT);
  const [lng, setLng] = useState(DEFAULT_LNG);
  const [locationQuery, setLocationQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [useMyLocation, setUseMyLocation] = useState(false);
  const [historyDays, setHistoryDays] = useState(7);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(
    async (latitude: number, longitude: number) => {
      setError(null);
      setLoading(true);
      try {
        const [current, hist, tipsRes] = await Promise.all([
          fetchCurrent(latitude, longitude),
          fetchHistory(historyDays).catch(() => null),
          fetchTips(),
        ]);
        setAqi(current);
        const recRes = await fetchRecommendation(current.aqi);
        setRecommendation(recRes);
        setHistoryData(hist ?? null);
        setTips(tipsRes)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
        setAqi(null);
        setRecommendation(null);
      } finally {
        setLoading(false);
      }
    },
    [historyDays]
  );

  useEffect(() => {
    if (useMyLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const la = pos.coords.latitude;
          const lo = pos.coords.longitude;
          setLat(la);
          setLng(lo);
          loadData(la, lo);
        },
        () => {
          setUseMyLocation(false);
          loadData(lat, lng);
        }
      );
    } else {
      loadData(lat, lng);
    }
  }, [useMyLocation]);

  const handleRefresh = () => {
    if (useMyLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => loadData(pos.coords.latitude, pos.coords.longitude),
        () => loadData(lat, lng)
      );
    } else {
      loadData(lat, lng);
    }
  };

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const q = locationQuery.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setGeocodeLoading(false);
      return;
    }

    setGeocodeLoading(true);
    searchDebounceRef.current = setTimeout(() => {
      fetchLocationSearch(q)
        .then((r) => {
          setSuggestions(r.results ?? []);
          setSuggestionsOpen(true);
        })
        .finally(() => setGeocodeLoading(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [locationQuery]);

  const handleSelectPlace = useCallback(
    (place: GeocodeResult) => {
      setLat(place.lat);
      setLng(place.lng);
      setLocationQuery(place.displayName);
      setSuggestions([]);
      setSuggestionsOpen(false);
      loadData(place.lat, place.lng);
    },
    [loadData]
  );

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = locationQuery.trim();
    if (suggestions.length > 0 && suggestionsOpen) {
      handleSelectPlace(suggestions[0]);
      return;
    }
    if (query.length >= 2) {
      setGeocodeLoading(true);
      try {
        const r = await fetchLocationSearch(query);
        if (r.results?.length) {
          const place = r.results[0];
          setLat(place.lat);
          setLng(place.lng);
          setLocationQuery(place.displayName);
          setSuggestions([]);
          setSuggestionsOpen(false);
          await loadData(place.lat, place.lng);
        } else {
          setError("No locations found. Try a different search or use coordinates.");
          loadData(lat, lng);
        }
      } finally {
        setGeocodeLoading(false);
      }
    } else {
      loadData(lat, lng);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setSuggestionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!loading && historyDays && !useMyLocation) {
      fetchHistory(historyDays)
        .then(setHistoryData)
        .catch(() => {});
    }
  }, [historyDays]);

  if (loading && !aqi) {
    return (
      <div className="dashboard loading-state">
        <div className="loader" />
        <p>Fetching air quality for your location…</p>
      </div>
    );
  }

  const suggestionList = suggestions.map((place: GeocodeResult) => (
    <li
      key={place.placeId}
      role="option"
      className="location-suggestion-item"
      onClick={() => handleSelectPlace(place)}
    >
      {place.displayName}
    </li>
  ));

  return (
    <>
      <div className="dashboard">
        <header className="dashboard-header">
          <h1 className="brand">
            <span className="brand-icon">🌬️</span> ClearSky
          </h1>
          <p className="tagline">Air quality at a glance</p>

          <form className="location-form" onSubmit={handleSearchSubmit}>
            <div className="location-search-wrap" ref={suggestionsRef}>
              <label className="location-search-label">
                <span>Search by city or place — we&apos;ll convert it to coordinates and fetch current AQI</span>
                <div className="location-input-wrapper">
                  <input
                    type="text"
                    className="location-search-input"
                    placeholder="e.g. London, Paris, Tokyo"
                    value={locationQuery}
                    onChange={(e) => setLocationQuery(e.target.value)}
                    onFocus={() => {
                      if (suggestions.length > 0) setSuggestionsOpen(true);
                    }}
                    autoComplete="off"
                    aria-busy={geocodeLoading}
                  />
                  {geocodeLoading && (
                    <span className="location-search-spinner" aria-hidden />
                  )}
                </div>
              </label>
              {suggestionsOpen && (suggestions.length > 0 || geocodeLoading) ? (
                <ul className="location-suggestions" role="listbox">
                  {geocodeLoading && suggestions.length === 0 ? (
                    <li className="location-suggestion-item location-suggestion-loading">
                      Finding locations…
                    </li>
                  ) : (
                    suggestionList
                  )}
                </ul>
              ) : null}
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setUseMyLocation(true)}
              >
                Use my location
              </button>
              <button type="submit" className="btn btn-primary">
                Get air quality
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleRefresh}
              >
                Refresh
              </button>
            </div>
          </form>
        </header>

        {error && <div className="alert alert-error">{error}</div>}

        {aqi && (
          <>
            <section className="card aqi-card">
              <div
                className="aqi-gauge"
                style={
                  { "--aqi-color": aqi.level.color } as React.CSSProperties
                }
              >
                <span className="aqi-value">{aqi.aqi}</span>
                <span className="aqi-label">{aqi.level.label}</span>
              </div>
              <div className="aqi-meta">
                <p className="aqi-city">{aqi.city}</p>
                <p className="aqi-time">
                  {new Date(aqi.time).toLocaleString()}
                </p>
                {aqi.dominantPollutant && (
                  <p className="aqi-dominant">
                    Dominant: {aqi.dominantPollutant.toUpperCase()}
                  </p>
                )}
              </div>
              <div className="pollutants">
                {Object.entries(aqi.pollutants).map(([key, value]) =>
                  value != null ? (
                    <span key={key} className="pollutant-tag">
                      {key.toUpperCase()}: {value}
                    </span>
                  ) : null
                )}
              </div>
            </section>

            {recommendation && (
              <section className="card recommendation-card">
                <h2>Recommendation</h2>
                <p
                  className="recommendation-text"
                  style={{ borderLeftColor: recommendation.color }}
                >
                  {recommendation.recommendation}
                </p>
                <div className="levels-legend">
                  {recommendation.allLevels.map((l) => (
                    <span
                      key={l.label}
                      className="level-dot"
                      style={{ background: l.color }}
                      title={l.label}
                    />
                  ))}
                </div>
              </section>
            )}

            {(historyData?.history?.length ?? 0) > 0 ? (
              <section className="card history-card">
                <div className="history-header">
                  <h2>History</h2>
                  <select
                    value={historyDays}
                    onChange={(e) =>
                      setHistoryDays(parseInt(e.target.value, 10))
                    }
                  >
                    <option value={3}>Last 3 days</option>
                    <option value={7}>Last 7 days</option>
                    <option value={14}>Last 14 days</option>
                    <option value={30}>Last 30 days</option>
                  </select>
                </div>
                <div className="history-list">
                  {historyData!.history.map((day: HistoryDay) => (
                    <div key={day.date} className="history-day">
                      <span className="history-date">{day.date}</span>
                      <span
                        className="history-avg"
                        style={{
                          color:
                            day.avgAqi <= 50
                              ? "#00e400"
                              : day.avgAqi <= 100
                              ? "#ffff00"
                              : day.avgAqi <= 150
                              ? "#ff7e00"
                              : "#ff0000",
                        }}
                      >
                        AQI {day.avgAqi}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <section className="card history-card">
                <h2>History</h2>
                <p className="history-empty">
                  History will appear here as you check air quality. Use
                  “Refresh” or search different locations to build it.
                </p>
              </section>
            )}

            {tips && (
              <section className="card tips-card">
                <h2>Tips to stay safe</h2>
                <ul className="tips-list">
                  {tips.tips.map((tip, i) => (
                    <li key={i}>{tip}</li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
