const API_BASE = "/aqi";

export type AqiLevel = {
  max: number;
  label: string;
  color: string;
  recommendation: string;
};

export type AqiCurrent = {
  city: string;
  aqi: number;
  dominantPollutant: string | null;
  pollutants: {
    pm25: number | null;
    pm10: number | null;
    no2: number | null;
    so2: number | null;
    o3: number | null;
  };
  time: string;
  level: AqiLevel;
};

export type Recommendation = {
  aqi: number;
  level: string;
  color: string;
  recommendation: string;
  allLevels: { upTo: number; label: string; color: string }[];
};

export type HistoryDay = {
  date: string;
  avgAqi: number;
  readings: {
    city: string;
    aqi: number;
    time: string;
    dominantPollutant?: string;
  }[];
};

export type HistoryResponse = {
  days: number;
  history: HistoryDay[];
};

export type TipsResponse = {
  tips: string[];
};

export type GeocodeResult = {
  displayName: string;
  lat: number;
  lng: number;
  placeId: number;
};

export type GeocodeResponse = {
  results: GeocodeResult[];
};

export async function fetchLocationSearch(
  query: string
): Promise<GeocodeResponse> {
  if (!query.trim()) return { results: [] };
  const res = await fetch(
    `${API_BASE}/geocode?q=${encodeURIComponent(query.trim())}`
  );
  if (!res.ok) return { results: [] };
  return res.json();
}

export async function fetchCurrent(
  lat: number,
  lng: number
): Promise<AqiCurrent> {
  const res = await fetch(`${API_BASE}/current?lat=${lat}&lng=${lng}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? "Failed to fetch AQI");
  }
  return res.json();
}

export async function fetchRecommendation(
  aqi: number
): Promise<Recommendation> {
  const res = await fetch(`${API_BASE}/recommendation?aqi=${aqi}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(
      (err as { error?: string }).error ?? "Failed to fetch recommendation"
    );
  }
  return res.json();
}

export async function fetchHistory(days: number): Promise<HistoryResponse> {
  const res = await fetch(`${API_BASE}/history/${days}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(
      (err as { error?: string }).error ?? "Failed to fetch history"
    );
  }
  return res.json();
}

export async function fetchTips(): Promise<TipsResponse> {
  const res = await fetch(`${API_BASE}/tips`);
  if (!res.ok) throw new Error("Failed to fetch tips");
  return res.json();
}
