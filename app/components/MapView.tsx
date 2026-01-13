"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";

/* =====================
   Types
===================== */
type Brewery = {
  id: string;
  name: string;
  brewery_type: string;
  address_1: string | null;
  city: string;
  state_province: string;
  latitude: string | number | null;
  longitude: string | number | null;
  website_url: string | null;
};

/* =====================
   Distance Helper (miles)
===================== */
function milesBetween(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const R = 3958.7613;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

/* =====================
   Marker Icon Fix,default ones had trouble rendering after 1st load
===================== */
const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

/* =====================
   Fit Bounds Helper
===================== */
function FitBounds({
  points,
  origin,
}: {
  points: Array<{ latitude: number; longitude: number }>;
  origin?: { lat: number; lon: number } | null;
}) {
  const map = useMap();

  useEffect(() => {
    const all: [number, number][] = points.map((p) => [
      p.latitude,
      p.longitude,
    ]);

    if (origin) all.push([origin.lat, origin.lon]);
    if (!all.length) return;

    map.fitBounds(L.latLngBounds(all), { padding: [40, 40] });
  }, [map, points, origin]);

  return null;
}

/* =====================
   FlyTo Helper
===================== */
function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;
    map.setView(target, Math.max(map.getZoom(), 14), { animate: true });
  }, [map, target]);

  return null;
}

/* =====================
   Brewery List (Left Panel)
===================== */
function BreweryList({
  breweries,
  onSelect,
}: {
  breweries: Array<
    Brewery & { latitude: number; longitude: number }
  >;
  onSelect: (b: Brewery & { latitude: number; longitude: number }) => void;
}) {
  return (
    <div
      style={{
        width: 360,
        height: 600,
        overflow: "auto",
        padding: 12,
        border: "1px solid #ddd",
        borderRadius: 8,
      }}
    >
      <strong>Results ({breweries.length})</strong>

      {breweries.map((b) => (
        <button
          key={b.id}
          onClick={() => onSelect(b)}
          style={{
            display: "block",
            width: "100%",
            textAlign: "left",
            padding: 10,
            marginTop: 10,
            border: "1px solid #eee",
            borderRadius: 8,
            background: "#fff",
            color: "#111",
            cursor: "pointer",
          }}
        >
          <div style={{ fontWeight: 600 }}>{b.name}</div>
          <div style={{ fontSize: 13 }}>
            {b.city}, {b.state_province}
          </div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {b.brewery_type}
          </div>
        </button>
      ))}
    </div>
  );
}

/* =====================
   Map View
===================== */
export default function MapView() {
  const [breweries, setBreweries] = useState<Brewery[]>([]);
  const [loading, setLoading] = useState(false);
  const [city, setCity] = useState("Denver");
  const [stateName, setStateName] = useState("Colorado");
  const [error, setError] = useState<string | null>(null);
  const [userLoc, setUserLoc] = useState<{ lat: number; lon: number } | null>(
    null
  );
  const [selected, setSelected] = useState<[number, number] | null>(null);

  /* ---------- Fetch by city/state ---------- */
  const fetchBreweries = async (nextCity: string, nextState: string) => {
    try {
      setLoading(true);
      setError(null);
      setUserLoc(null);

      const qs = new URLSearchParams({
        city: nextCity,
        state: nextState,
        per_page: "50",
      });

      const res = await fetch(`/api/breweries?${qs.toString()}`);
      const json = await res.json();

      setBreweries(Array.isArray(json) ? json : json.breweries ?? []);
    } catch {
      setError("Error fetching breweries.");
      setBreweries([]);
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Fetch by geolocation ---------- */
  const fetchBreweriesByCoords = async (
    lat: number,
    lon: number,
    radiusMiles: number
  ) => {
    try {
      setLoading(true);
      setError(null);
      setUserLoc({ lat, lon });

      const qs = new URLSearchParams({
        lat: String(lat),
        lon: String(lon),
        radius: String(radiusMiles),
        per_page: "200",
      });

      const res = await fetch(`/api/breweries?${qs.toString()}`);
      const json = await res.json();

      setBreweries(Array.isArray(json) ? json : json.breweries ?? []);
    } catch {
      setError("Error fetching breweries.");
      setBreweries([]);
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Initial load ---------- */
  useEffect(() => {
    fetchBreweries(city, stateName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Normalize coordinates ---------- */
  const breweriesWithCoords = useMemo(() => {
    return breweries
      .filter((b) => b.latitude && b.longitude)
      .map((b) => ({
        ...b,
        latitude: Number(b.latitude),
        longitude: Number(b.longitude),
      }));
  }, [breweries]);

  /* =====================
     Render
  ===================== */
  return (
    <div style={{ display: "flex", gap: 12 }}>
      {/* Left: Brewery List */}
      <BreweryList
        breweries={breweriesWithCoords}
        onSelect={(b) => setSelected([b.latitude, b.longitude])}
      />

      {/* Right: Search + Map */}
      <div style={{ width: "100%" }}>
        {/* Search UI */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchBreweries(city.trim(), stateName.trim());
          }}
          style={{ display: "flex", gap: 8, marginBottom: 8 }}
        >
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City (e.g., Denver)"
            style={{ padding: 8, flex: 1 }}
          />
          <input
            value={stateName}
            onChange={(e) => setStateName(e.target.value)}
            placeholder="State (e.g., Colorado)"
            style={{ padding: 8, flex: 1 }}
          />
          <button type="submit" disabled={loading}>
            {loading ? "Searching…" : "Search"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              if (!navigator.geolocation) {
                setError("Geolocation not supported.");
                return;
              }

              navigator.geolocation.getCurrentPosition(
                (pos) =>
                  fetchBreweriesByCoords(
                    pos.coords.latitude,
                    pos.coords.longitude,
                    30
                  ),
                () =>
                  setError("Could not get your location."),
                { enableHighAccuracy: true }
              );
            }}
          >
            Use my location
          </button>
        </form>

        {error && <div>{error}</div>}
        {loading && <div>Loading breweries…</div>}

        {/* Map */}
        <MapContainer
          center={[39.7392, -104.9903]}
          zoom={12}
          style={{ height: 500, width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />

          {userLoc && (
            <Marker position={[userLoc.lat, userLoc.lon]}>
              <Popup>You are here</Popup>
            </Marker>
          )}

          {breweriesWithCoords.map((b) => (
            <Marker
              key={b.id}
              position={[b.latitude, b.longitude]}
              icon={markerIcon}
            >
              <Popup>
                <strong>{b.name}</strong>
                <br />
                {b.address_1 ?? "Address not listed"}
                <br />
                {b.city}, {b.state_province}
                <br />
                <em>{b.brewery_type}</em>

                {b.website_url && (
                  <>
                    <br />
                    <a href={b.website_url} target="_blank" rel="noreferrer">
                      Website
                    </a>
                  </>
                )}

                {userLoc && (
                  <>
                    <br />
                    Distance:{" "}
                    {milesBetween(
                      userLoc.lat,
                      userLoc.lon,
                      b.latitude,
                      b.longitude
                    ).toFixed(1)}{" "}
                    miles
                  </>
                )}
              </Popup>
            </Marker>
          ))}

          <FitBounds points={breweriesWithCoords} origin={userLoc} />
          <FlyTo target={selected} />
        </MapContainer>
      </div>
    </div>
  );
}
