import { NextResponse } from "next/server";

function toRad(n: number) {
  return (n * Math.PI) / 180;
}

// Haversine distance in miles
function milesBetween(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.7613; // earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

type Brewery = {
  id: string;
  name: string;
  brewery_type: string;
  address_1: string | null;
  city: string;
  state_province: string;
  latitude: number | null;
  longitude: number | null;
  website_url: string | null;
};

async function geocodeCityState(city: string, state: string) {
  const q = `${city}, ${state}, USA`;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  // Nominatim requires a User-Agent identifying your app
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "brewery-map/1.0 (contact: example@example.com)" },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!data.length) return null;

  return { lat: Number(data[0].lat), lon: Number(data[0].lon) };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const city = searchParams.get("city") || "Denver";
  const state = searchParams.get("state") || "Colorado";

  const latParam = searchParams.get("lat");
  const lonParam = searchParams.get("lon");
  const radiusParam = searchParams.get("radius") || "30";
  const perPageParam = searchParams.get("per_page") || "200"; // max 200 :contentReference[oaicite:1]{index=1}

  const radiusMiles = Number(radiusParam);
  const perPage = Math.min(Number(perPageParam), 200);

  let originLat: number | null = latParam ? Number(latParam) : null;
  let originLon: number | null = lonParam ? Number(lonParam) : null;

  // If no lat/lon provided, geocode the city/state to get an origin point
  if ((originLat === null || originLon === null) && radiusMiles > 0) {
    const geo = await geocodeCityState(city, state);
    if (geo) {
      originLat = geo.lat;
      originLon = geo.lon;
    }
  }

  const url = new URL("https://api.openbrewerydb.org/v1/breweries");
  url.searchParams.set("per_page", String(perPage));

  if (originLat !== null && originLon !== null) {
    // Sort by distance from this point :contentReference[oaicite:2]{index=2}
    url.searchParams.set("by_dist", `${originLat},${originLon}`);
  } else {
    // fallback: city/state filter :contentReference[oaicite:3]{index=3}
    url.searchParams.set("by_city", city);
    url.searchParams.set("by_state", state);
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to fetch breweries" },
      { status: res.status }
    );
  }

  const data = (await res.json()) as Brewery[];

  // If we have an origin + radius, filter to radius
  if (originLat !== null && originLon !== null && radiusMiles > 0) {
    const filtered = data.filter((b) => {
      if (typeof b.latitude !== "number" || typeof b.longitude !== "number") return false;
      const d = milesBetween(originLat!, originLon!, b.latitude, b.longitude);
      return d <= radiusMiles;
    });

    return NextResponse.json({
      origin: { lat: originLat, lon: originLon, radiusMiles },
      breweries: filtered,
    });
  }

  return NextResponse.json({ breweries: data });
}
