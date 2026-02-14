import axios from "axios";
import type { Request, Response } from "express";
import { BASE_URL, token } from "../utils";

const AQI_LEVELS = [
  {
    max: 50,
    label: "Good",
    color: "#00e400",
    recommendation: "Air quality is satisfactory. Enjoy outdoor activities.",
  },
  {
    max: 100,
    label: "Moderate",
    color: "#ffff00",
    recommendation:
      "Acceptable quality. Unusually sensitive people should consider reducing prolonged outdoor exertion.",
  },
  {
    max: 150,
    label: "Unhealthy for Sensitive",
    color: "#ff7e00",
    recommendation:
      "Members of sensitive groups may experience health effects. Consider reducing outdoor activities.",
  },
  {
    max: 200,
    label: "Unhealthy",
    color: "#ff0000",
    recommendation:
      "Everyone may experience health effects. Avoid prolonged outdoor exertion. Sensitive groups should stay indoors.",
  },
  {
    max: 300,
    label: "Very Unhealthy",
    color: "#8f3f97",
    recommendation:
      "Health alert: everyone may experience serious effects. Stay indoors, close windows, use air purifiers.",
  },
  {
    max: 500,
    label: "Hazardous",
    color: "#7e0023",
    recommendation:
      "Emergency conditions. Avoid all outdoor activity. Stay indoors with windows closed. Use N95 masks if you must go out.",
  },
] as const;

const SAFETY_TIPS = [
  "Check AQI before outdoor exercise and plan for early morning when pollution is often lower.",
  "On high AQI days, keep windows closed and use air conditioning or an air purifier.",
  "Wear N95 or KN95 masks when AQI is Unhealthy or worse, especially near traffic.",
  "Avoid vigorous outdoor activity when AQI is above 100; choose indoor workouts instead.",
  "Vulnerable groups (children, elderly, those with heart/lung conditions) should limit exposure when AQI > 100.",
  "Use the air quality index to choose the best time of day for errands or commutes.",
  "Consider indoor plants that can help filter some pollutants (e.g., peace lily, spider plant).",
  "On bad air days, shower and change after being outside to reduce particle exposure.",
];

// In-memory history (last 500 readings). Use DB when DATABASE_URL is set.
type AqiRecord = {
  city: string;
  aqi: number;
  lat: number;
  lng: number;
  time: string;
  dominantPollutant?: string;
};
const aqiHistoryStore: AqiRecord[] = [];
const MAX_HISTORY = 500;

function getLevel(aqi: number) {
  for (const level of AQI_LEVELS) {
    if (aqi <= level.max) return level;
  }
  return AQI_LEVELS[AQI_LEVELS.length - 1];
}

async function getData(req: Request, res: Response) {
  const lat = req.query.lat as string | undefined;
  const lng = req.query.lng as string | undefined;

  if (!lat || !lng) {
    res
      .status(400)
      .json({ error: "lat and lng query parameters are required" });
    return;
  }

  const numLat = parseFloat(lat);
  const numLng = parseFloat(lng);
  if (Number.isNaN(numLat) || Number.isNaN(numLng)) {
    res.status(400).json({ error: "lat and lng must be valid numbers" });
    return;
  }

  try {
    // WAQI format: geo:lat;lng
    const url = `${BASE_URL}geo:${numLat};${numLng}/?token=${token}`;
    const response = await axios.get(url);
    const data = response.data;

    if (data.status !== "ok" || data.data == null) {
      res
        .status(502)
        .json({ error: "Invalid response from AQI service", detail: data });
      return;
    }

    const d = data.data;
    const aqi = d.aqi ?? 0;
    const cityName = d.city?.name ?? "Unknown";
    const dominantPol = d.dominentpol ?? null;

    const formatted = {
      city: cityName,
      aqi,
      dominantPollutant: dominantPol,
      pollutants: {
        pm25: d.iaqi?.pm25?.v ?? null,
        pm10: d.iaqi?.pm10?.v ?? null,
        no2: d.iaqi?.no2?.v ?? null,
        so2: d.iaqi?.so2?.v ?? null,
        o3: d.iaqi?.o3?.v ?? null,
      },
      time: d.time?.s ?? new Date().toISOString(),
      level: getLevel(aqi),
    };

    // Append to in-memory history
    aqiHistoryStore.push({
      city: cityName,
      aqi,
      lat: numLat,
      lng: numLng,
      time: formatted.time,
      dominantPollutant: dominantPol ?? undefined,
    });
    if (aqiHistoryStore.length > MAX_HISTORY) aqiHistoryStore.shift();

    res.json(formatted);
  } catch (err: unknown) {
    const message = axios.isAxiosError(err)
      ? err.response?.data ?? err.message
      : "Failed to fetch AQI";
    res
      .status(500)
      .json({ error: "Failed to fetch AQI data", detail: String(message) });
  }
}

function getRecommendation(req: Request, res: Response) {
  const aqiParam = (req.query.aqi as string) ?? req.body?.aqi;
  const aqi = aqiParam != null ? parseInt(String(aqiParam), 10) : null;

  if (aqi == null || Number.isNaN(aqi)) {
    res.status(400).json({ error: "aqi query parameter is required" });
    return;
  }

  const level = getLevel(aqi);
  res.json({
    aqi,
    level: level.label,
    color: level.color,
    recommendation: level.recommendation,
    allLevels: AQI_LEVELS.map((l) => ({
      upTo: l.max,
      label: l.label,
      color: l.color,
    })),
  });
}

function getHistory(req: Request, res: Response) {
  const daysParam = req.params.days;
  const days = daysParam ? parseInt(daysParam, 10) : 7;

  if (Number.isNaN(days) || days < 1 || days > 90) {
    res.status(400).json({ error: "days must be a number between 1 and 90" });
    return;
  }

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString();

  const filtered = aqiHistoryStore.filter((r) => r.time >= sinceStr);
  const byDay = new Map<
    string,
    { date: string; readings: AqiRecord[]; avgAqi: number }
  >();

  for (const r of filtered) {
    const date = r.time.slice(0, 10);
    if (!byDay.has(date)) {
      byDay.set(date, { date, readings: [], avgAqi: 0 });
    }
    const entry = byDay.get(date)!;
    entry.readings.push(r);
  }

  const history = Array.from(byDay.values()).map((entry) => {
    const sum = entry.readings.reduce((a, x) => a + x.aqi, 0);
    entry.avgAqi = Math.round(sum / entry.readings.length);
    return { date: entry.date, avgAqi: entry.avgAqi, readings: entry.readings };
  });

  history.sort((a, b) => a.date.localeCompare(b.date));

  res.json({ days, history });
}

function getTips(_req: Request, res: Response) {
  res.json({ tips: SAFETY_TIPS });
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const GEOCODE_LIMIT = 8;

async function getGeocode(req: Request, res: Response) {
  const q = (req.query.q as string)?.trim();
  if (!q || q.length < 2) {
    res.json({ results: [] });
    return;
  }
  try {
    const { data } = await axios.get<
      { display_name: string; lat: string; lon: string; place_id: number }[]
    >(NOMINATIM_URL, {
      params: { q, format: "json", limit: GEOCODE_LIMIT },
      headers: { "User-Agent": "ClearSky-AirQuality/1.0" },
    });
    const results = (Array.isArray(data) ? data : []).map((item) => ({
      displayName: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      placeId: item.place_id,
    }));
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: "Geocoding failed", results: [] });
  }
}

export { getData, getGeocode, getHistory, getRecommendation, getTips };
