let lastGeocodeAt = 0;
let geocodeQueue = Promise.resolve();

function geocodeAddress(address) {
  const lookup = geocodeQueue.then(async () => {
    const wait = Math.max(0, 1000 - (Date.now() - lastGeocodeAt));
    if (wait) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    lastGeocodeAt = Date.now();

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", address);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "de",
        "User-Agent": "LichtUndFreude/1.0 (info@licht-und-freude.com)",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`Address lookup returned HTTP ${response.status}.`);
    }

    const results = await response.json();
    const latitude = Number(results[0]?.lat);
    const longitude = Number(results[0]?.lon);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return null;
    }

    return { latitude, longitude };
  });

  geocodeQueue = lookup.then(
    () => undefined,
    () => undefined
  );
  return lookup;
}

module.exports = geocodeAddress;
