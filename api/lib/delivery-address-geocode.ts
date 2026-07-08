type PenzaAddressValidationResult =
  | {
      ok: true;
      normalizedAddress: string;
      coordinates: [number, number] | null;
    }
  | {
      ok: false;
      message: string;
    };

export type PenzaDeliveryAddressSuggestion = {
  label: string;
  street: string;
  house: string;
  coordinates: [number, number] | null;
};

export type PenzaDeliveryStreetSuggestion = {
  label: string;
  street: string;
};

const PENZA_CITY_TOKENS = ["пенза", "penza"];
const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const STREET_PREFIXES = new Set([
  "ул",
  "улица",
  "пр",
  "проспект",
  "пр-кт",
  "переулок",
  "пер",
  "проезд",
  "площадь",
  "пл",
  "бульвар",
  "бул",
  "шоссе",
  "ш",
  "набережная",
  "наб",
  "аллея",
  "линия",
  "тракт",
  "тупик",
  "туп",
  "мкр",
  "микрорайон",
]);

function normalizeAddressPart(value: string | null | undefined) {
  return (value || "").trim().replace(/\s+/g, " ");
}

function normalizeStreetName(value: string | null | undefined) {
  return normalizeAddressPart(value)
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter(part => !STREET_PREFIXES.has(part))
    .join(" ");
}

function normalizeHouseName(value: string | null | undefined) {
  return normalizeAddressPart(value).toUpperCase().replace(/\s+/g, "");
}

function areStreetNamesClose(inputStreet: string, candidateStreet: string) {
  const left = normalizeStreetName(inputStreet);
  const right = normalizeStreetName(candidateStreet);

  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length >= 5 && right.includes(left)) return true;
  if (right.length >= 5 && left.includes(right)) return true;

  return false;
}

function containsPenza(value: string) {
  const normalized = value.toLowerCase();
  return PENZA_CITY_TOKENS.some(token => normalized.includes(token));
}

function isPenzaAddress(address: {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  suburb?: string;
  city_district?: string;
  state?: string;
} | null | undefined) {
  const values = [
    address?.city,
    address?.town,
    address?.village,
    address?.municipality,
    address?.county,
    address?.suburb,
    address?.city_district,
    address?.state,
  ]
    .map(value => normalizeAddressPart(value))
    .filter(Boolean);

  return values.some(containsPenza);
}

function parseCoordinate(value: string | null | undefined) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

type NominatimAddressPayload = {
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    suburb?: string;
    city_district?: string;
    state?: string;
    road?: string;
    house_number?: string;
  };
};

function mapSuggestion(item: {
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    road?: string;
    house_number?: string;
  };
}): PenzaDeliveryAddressSuggestion | null {
  const displayName = normalizeAddressPart(item.display_name);
  const street = normalizeAddressPart(item.address?.road);
  const house = normalizeAddressPart(item.address?.house_number);

  if (
    !displayName ||
    (!containsPenza(displayName) && !isPenzaAddress(item.address)) ||
    !street ||
    !house
  ) {
    return null;
  }

  const lat = parseCoordinate(item.lat);
  const lon = parseCoordinate(item.lon);

  return {
    label: displayName,
    street,
    house,
    coordinates:
      lat !== null && lon !== null ? ([lon, lat] as [number, number]) : null,
  };
}

function mapStreetSuggestion(item: {
  display_name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    road?: string;
  };
}): PenzaDeliveryStreetSuggestion | null {
  const displayName = normalizeAddressPart(item.display_name);
  const street = normalizeAddressPart(item.address?.road);

  if (
    !displayName ||
    (!containsPenza(displayName) && !isPenzaAddress(item.address)) ||
    !street
  ) {
    return null;
  }

  return {
    label: street,
    street,
  };
}

async function fetchNominatimPayload(
  params: Record<string, string>,
): Promise<NominatimAddressPayload[]> {
  const url = new URL(NOMINATIM_ENDPOINT);

  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", params.limit ?? "10");
  url.searchParams.set("countrycodes", "ru");
  url.searchParams.set("addressdetails", "1");

  for (const [key, value] of Object.entries(params)) {
    if (key === "limit") continue;
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "Accept-Language": "ru",
      "User-Agent": "TechaksCheckout/1.0 (support@techaks.ru)",
    },
  });

  if (!response.ok) {
    return [];
  }

  return (await response.json()) as NominatimAddressPayload[];
}

async function fetchPenzaStreetCandidates(street: string) {
  const direct = await fetchNominatimPayload({
    limit: "10",
    city: "Пенза",
    street,
  });

  if (direct.length > 0) {
    return direct;
  }

  return await fetchNominatimPayload({
    limit: "10",
    q: `Пенза, ${street}`,
  });
}

async function fetchPenzaAddressCandidates(street: string, house: string) {
  const direct = await fetchNominatimPayload({
    limit: "8",
    city: "Пенза",
    street: `${house} ${street}`,
  });

  if (direct.length > 0) {
    return direct;
  }

  const exact = await fetchNominatimPayload({
    limit: "8",
    q: `Пенза, ${street}, ${house}`,
  });

  if (exact.length > 0) {
    return exact;
  }

  return await fetchNominatimPayload({
    limit: "8",
    q: `Пенза, ${house} ${street}`,
  });
}

export async function searchPenzaDeliveryAddresses(input: {
  street: string;
  house: string;
}): Promise<PenzaDeliveryAddressSuggestion[]> {
  const street = normalizeAddressPart(input.street);
  const house = normalizeAddressPart(input.house);

  if (!street || !house) {
    return [];
  }

  try {
    const payload = await fetchPenzaAddressCandidates(street, house);

    const seen = new Set<string>();

    return payload
      .map(mapSuggestion)
      .filter((item): item is PenzaDeliveryAddressSuggestion => Boolean(item))
      .filter(item => {
        if (!areStreetNamesClose(street, item.street)) return false;
        const key = `${normalizeStreetName(item.street)}|${normalizeHouseName(item.house)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  } catch {
    return [];
  }
}

export async function searchPenzaDeliveryStreets(input: {
  street: string;
}): Promise<PenzaDeliveryStreetSuggestion[]> {
  const street = normalizeAddressPart(input.street);

  if (!street) {
    return [];
  }

  try {
    const payload = await fetchPenzaStreetCandidates(street);

    const seen = new Set<string>();

    return payload
      .map(mapStreetSuggestion)
      .filter((item): item is PenzaDeliveryStreetSuggestion => Boolean(item))
      .filter(item => {
        if (!areStreetNamesClose(street, item.street)) return false;
        const key = normalizeStreetName(item.street);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  } catch {
    return [];
  }
}

export async function validatePenzaDeliveryAddress(input: {
  street: string;
  house: string;
}): Promise<PenzaAddressValidationResult> {
  const street = normalizeAddressPart(input.street);
  const house = normalizeAddressPart(input.house);
  const query = `${street}, ${house}, Пенза`;

  try {
    const payload = await fetchPenzaAddressCandidates(street, house);

    const match = payload.find(item => {
      const mapped = mapSuggestion(item);
      const requestedHouse = normalizeHouseName(house);

      if (!mapped) return false;
      if (!areStreetNamesClose(street, mapped.street)) return false;
      if (normalizeHouseName(mapped.house) !== requestedHouse) return false;

      return true;
    });

    if (!match) {
      const streetMatches = payload
        .map(item => normalizeAddressPart(item.address?.road))
        .filter(candidate => areStreetNamesClose(street, candidate));

      if (streetMatches.length > 0) {
        return {
          ok: true,
          normalizedAddress: `Пенза, ${street}, ${house}`,
          coordinates: null,
        };
      }

      const knownStreetSuggestions = await searchPenzaDeliveryStreets({ street });
      if (knownStreetSuggestions.length > 0) {
        return {
          ok: true,
          normalizedAddress: `Пенза, ${knownStreetSuggestions[0]!.street}, ${house}`,
          coordinates: null,
        };
      }

      return {
        ok: false,
        message:
          `Мы не смогли подтвердить адрес «${query}». Проверьте улицу и номер дома.`,
      };
    }

    const mapped = mapSuggestion(match);

    return {
      ok: true,
      normalizedAddress: mapped?.label || normalizeAddressPart(match.display_name || query),
      coordinates: mapped?.coordinates || null,
    };
  } catch {
    return {
      ok: false,
      message:
        "Не удалось проверить адрес доставки. Повторите попытку или уточните адрес.",
    };
  }
}
