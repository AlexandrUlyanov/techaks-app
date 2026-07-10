import { env } from "./env";
import { getYandexGeoSuggestRuntimeSettings } from "./yandex-delivery-settings";

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
  source: "geosuggest" | "yandex_geocoder" | "nominatim";
};

export type PenzaDeliveryStreetSuggestion = {
  label: string;
  street: string;
  source: "geosuggest" | "yandex_geocoder" | "nominatim";
};

export type PenzaDeliveryAddressLineSuggestion = {
  label: string;
  addressLine: string;
  street: string;
  house: string;
  coordinates: [number, number] | null;
  type: "street" | "address";
  source: "geosuggest" | "yandex_geocoder" | "nominatim";
};

const PENZA_CITY_TOKENS = ["пенза", "penza"];
const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const YANDEX_GEOCODER_ENDPOINT = "https://geocode-maps.yandex.ru/v1/";
const YANDEX_GEOSUGGEST_ENDPOINT = "https://suggest-maps.yandex.ru/v1/suggest";
const PENZA_BBOX = "44.75,53.10~45.15,53.32";
const GEOCODER_CACHE_TTL_MS = 10 * 60 * 1000;
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

const yandexGeocoderCache = new Map<
  string,
  { expiresAt: number; value: YandexGeocoderFeature[] }
>();

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

export function parsePenzaDeliveryAddressLine(value: string | null | undefined) {
  const addressLine = normalizeAddressPart(value)
    .replace(/^пенза\s*,?\s*/i, "")
    .replace(/^г\.?\s*пенза\s*,?\s*/i, "");

  if (!addressLine) {
    return { street: "", house: "" };
  }

  const commaParts = addressLine
    .split(",")
    .map(part => normalizeAddressPart(part))
    .filter(Boolean);

  if (commaParts.length >= 2) {
    return {
      street: commaParts[0] || "",
      house: commaParts[1] || "",
    };
  }

  const match = addressLine.match(
    /^(.*?)(?:\s+)(\d{1,4}[A-Za-zА-Яа-яЁё]?(?:[/-]\d{1,4}[A-Za-zА-Яа-яЁё]?)?(?:\s?(?:к|корп|корпус|стр|строение)\.?\s?\d{1,3}[A-Za-zА-Яа-яЁё]?)?)$/i,
  );

  if (!match) {
    return { street: addressLine, house: "" };
  }

  return {
    street: normalizeAddressPart(match[1]),
    house: normalizeAddressPart(match[2]),
  };
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

type YandexGeocoderFeature = {
  GeoObject?: {
    name?: string;
    description?: string;
    Point?: {
      pos?: string;
    };
    metaDataProperty?: {
      GeocoderMetaData?: {
        kind?: string;
        precision?: string;
        text?: string;
        Address?: {
          Components?: Array<{
            kind?: string;
            name?: string;
          }>;
        };
      };
    };
  };
};

type YandexGeoSuggestItem = {
  title?: string | { text?: string };
  subtitle?: string | { text?: string };
  address?: {
    formatted_address?: string;
    component?: Array<{
      name?: string;
      kind?: string[] | string;
    }>;
    components?: Array<{
      name?: string;
      kind?: string[] | string;
    }>;
  };
  display_name?: string;
  uri?: string;
};

function getSuggestText(value: string | { text?: string } | null | undefined) {
  return normalizeAddressPart(
    typeof value === "string" ? value : value?.text,
  );
}

function getGeoSuggestComponent(
  item: YandexGeoSuggestItem,
  kind: string,
): string {
  const components = [
    ...(item.address?.component ?? []),
    ...(item.address?.components ?? []),
  ];

  return normalizeAddressPart(
    components.find(component => {
      const kinds = Array.isArray(component.kind)
        ? component.kind
        : component.kind
          ? [component.kind]
          : [];
      return kinds.includes(kind);
    })?.name,
  );
}

function parseHouseFromSuggestionLabel(label: string) {
  const normalized = normalizeAddressPart(label);
  const parts = normalized.split(",").map(part => normalizeAddressPart(part));
  const lastPart = parts.at(-1) || "";
  const houseMatch = lastPart.match(/\b\d+[А-ЯA-Zа-яa-z]?(?:[/-]\d+[А-ЯA-Zа-яa-z]?)?\b/u);

  return houseMatch ? normalizeAddressPart(houseMatch[0]) : "";
}

function looksLikeHouseSuggestion(value: string) {
  return /,\s*\d/.test(value) || /\b\d+[А-ЯA-Zа-яa-z]?\b/u.test(value);
}

function cleanPenzaSuggestionLabel(value: string) {
  const label = normalizeAddressPart(value)
    .replace(/^Россия\s*,?\s*/i, "")
    .replace(/^Пензенская область\s*,?\s*/i, "")
    .replace(/^городской округ Пенза\s*,?\s*/i, "")
    .replace(/^г\.?\s*Пенза\s*,?\s*/i, "Пенза, ");

  return normalizeAddressPart(label);
}

function buildPenzaLineLabel(input: {
  label: string;
  street: string;
  house?: string;
}) {
  const label = cleanPenzaSuggestionLabel(input.label);

  if (containsPenza(label)) {
    return label;
  }

  const street = normalizeAddressPart(input.street);
  const house = normalizeAddressPart(input.house);

  return normalizeAddressPart(
    ["Пенза", street, house].filter(Boolean).join(", "),
  );
}

function getYandexComponent(
  item: YandexGeocoderFeature,
  kind: string,
): string {
  const components =
    item.GeoObject?.metaDataProperty?.GeocoderMetaData?.Address?.Components ??
    [];

  return normalizeAddressPart(
    components.find(component => component.kind === kind)?.name,
  );
}

function isYandexPenzaFeature(item: YandexGeocoderFeature) {
  const meta = item.GeoObject?.metaDataProperty?.GeocoderMetaData;
  const text = normalizeAddressPart(meta?.text);
  const locality = getYandexComponent(item, "locality");
  const province = getYandexComponent(item, "province");
  const area = getYandexComponent(item, "area");

  return [text, locality, province, area].some(containsPenza);
}

function parseYandexCoordinates(pos: string | null | undefined) {
  const [lon, lat] = normalizeAddressPart(pos)
    .split(/\s+/)
    .map(value => Number(value));

  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;

  return [lon, lat] as [number, number];
}

function mapYandexSuggestion(
  item: YandexGeocoderFeature,
): PenzaDeliveryAddressSuggestion | null {
  const meta = item.GeoObject?.metaDataProperty?.GeocoderMetaData;
  const label = normalizeAddressPart(meta?.text || item.GeoObject?.name);
  const street = getYandexComponent(item, "street");
  const house = getYandexComponent(item, "house");

  if (!label || !isYandexPenzaFeature(item) || !street || !house) {
    return null;
  }

  return {
    label,
    street,
    house,
    coordinates: parseYandexCoordinates(item.GeoObject?.Point?.pos),
    source: "yandex_geocoder",
  };
}

function mapYandexStreetSuggestion(
  item: YandexGeocoderFeature,
): PenzaDeliveryStreetSuggestion | null {
  const street = getYandexComponent(item, "street");
  const name = normalizeAddressPart(item.GeoObject?.name);

  if (!isYandexPenzaFeature(item) || !street) {
    return null;
  }

  return {
    label: street || name,
    street: street || name,
    source: "yandex_geocoder",
  };
}

async function fetchYandexGeocoderFeatures(input: {
  query: string;
  limit: number;
}): Promise<YandexGeocoderFeature[]> {
  const apiKey = env.yandexGeocoderApiKey;
  const query = normalizeAddressPart(input.query);

  if (!apiKey || !query) return [];

  const cacheKey = `${query}|${input.limit}`;
  const cached = yandexGeocoderCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const url = new URL(YANDEX_GEOCODER_ENDPOINT);
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("geocode", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("lang", "ru_RU");
  url.searchParams.set("results", String(input.limit));
  url.searchParams.set("bbox", PENZA_BBOX);
  url.searchParams.set("strict_bounds", "1");
  url.searchParams.set("countries", "ru");

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "TechaksCheckout/1.0",
      },
    });

    if (!response.ok) return [];

    const payload = (await response.json()) as {
      response?: {
        GeoObjectCollection?: {
          featureMember?: YandexGeocoderFeature[];
        };
      };
    };
    const value = payload.response?.GeoObjectCollection?.featureMember ?? [];

    yandexGeocoderCache.set(cacheKey, {
      expiresAt: Date.now() + GEOCODER_CACHE_TTL_MS,
      value,
    });

    return value;
  } catch {
    return [];
  }
}

async function fetchYandexGeoSuggestItems(input: {
  query: string;
  limit: number;
}): Promise<YandexGeoSuggestItem[]> {
  const settings = await getYandexGeoSuggestRuntimeSettings();
  const query = normalizeAddressPart(input.query);

  if (!settings.enabled || !settings.apiKey || !query) return [];

  const url = new URL(YANDEX_GEOSUGGEST_ENDPOINT);
  url.searchParams.set("apikey", settings.apiKey);
  url.searchParams.set("text", query);
  url.searchParams.set("types", "geo");
  url.searchParams.set("print_address", "1");
  url.searchParams.set("lang", "ru_RU");
  url.searchParams.set("results", String(input.limit));
  url.searchParams.set("bbox", PENZA_BBOX);
  url.searchParams.set("strict_bounds", "1");
  url.searchParams.set("countries", "ru");

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "Accept-Language": "ru",
        "User-Agent": "TechaksCheckout/1.0",
      },
    });

    if (!response.ok) return [];

    const payload = (await response.json()) as {
      results?: YandexGeoSuggestItem[];
    };

    return Array.isArray(payload.results) ? payload.results : [];
  } catch {
    return [];
  }
}

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
    source: "nominatim",
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
    source: "nominatim",
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

async function fetchYandexPenzaStreetSuggestions(street: string) {
  const features = await fetchYandexGeocoderFeatures({
    query: `Пенза, ${street}`,
    limit: 10,
  });

  return features
    .map(mapYandexStreetSuggestion)
    .filter((item): item is PenzaDeliveryStreetSuggestion => Boolean(item));
}

async function fetchYandexPenzaAddressSuggestions(street: string, house: string) {
  const features = await fetchYandexGeocoderFeatures({
    query: `Пенза, ${street}, ${house}`,
    limit: 8,
  });

  return features
    .map(mapYandexSuggestion)
    .filter((item): item is PenzaDeliveryAddressSuggestion => Boolean(item));
}

function mapGeoSuggestStreetSuggestion(
  item: YandexGeoSuggestItem,
): PenzaDeliveryStreetSuggestion | null {
  const label = normalizeAddressPart(
    item.address?.formatted_address ||
      [getSuggestText(item.subtitle), getSuggestText(item.title)]
        .filter(Boolean)
        .join(", ") ||
      item.display_name,
  );
  const street =
    getGeoSuggestComponent(item, "street") ||
    getSuggestText(item.title).replace(/^улица\s+/i, "");

  if (!label || !containsPenza(label) || !street) return null;
  if (!getGeoSuggestComponent(item, "street") && looksLikeHouseSuggestion(street)) {
    return null;
  }

  return {
    label: street,
    street,
    source: "geosuggest",
  };
}

function mapGeoSuggestAddressSuggestion(
  item: YandexGeoSuggestItem,
  fallbackStreet: string,
): PenzaDeliveryAddressSuggestion | null {
  const label = normalizeAddressPart(
    item.address?.formatted_address ||
      [getSuggestText(item.subtitle), getSuggestText(item.title)]
        .filter(Boolean)
        .join(", ") ||
      item.display_name,
  );
  const street = getGeoSuggestComponent(item, "street") || fallbackStreet;
  const house =
    getGeoSuggestComponent(item, "house") || parseHouseFromSuggestionLabel(label);

  if (!label || !containsPenza(label) || !street || !house) return null;

  return {
    label: buildPenzaLineLabel({ label, street, house }),
    street,
    house,
    coordinates: null,
    source: "geosuggest",
  };
}

function mapGeoSuggestAddressLineSuggestion(
  item: YandexGeoSuggestItem,
  fallbackStreet: string,
): PenzaDeliveryAddressLineSuggestion | null {
  const rawLabel = normalizeAddressPart(
    item.address?.formatted_address ||
      [getSuggestText(item.subtitle), getSuggestText(item.title)]
        .filter(Boolean)
        .join(", ") ||
      item.display_name,
  );
  const title = getSuggestText(item.title);
  const street =
    getGeoSuggestComponent(item, "street") ||
    fallbackStreet ||
    title.replace(/^улица\s+/i, "");
  const house =
    getGeoSuggestComponent(item, "house") || parseHouseFromSuggestionLabel(rawLabel);

  if (!rawLabel || !containsPenza(rawLabel) || !street) return null;

  const label = buildPenzaLineLabel({ label: rawLabel, street, house });

  return {
    label,
    addressLine: label,
    street,
    house,
    coordinates: null,
    type: house ? "address" : "street",
    source: "geosuggest",
  };
}

async function fetchGeoSuggestPenzaStreetSuggestions(street: string) {
  const items = await fetchYandexGeoSuggestItems({
    query: `Пенза, ${street}`,
    limit: 10,
  });

  return items
    .map(mapGeoSuggestStreetSuggestion)
    .filter((item): item is PenzaDeliveryStreetSuggestion => Boolean(item));
}

async function fetchGeoSuggestPenzaAddressSuggestions(
  street: string,
  house: string,
) {
  const items = await fetchYandexGeoSuggestItems({
    query: `Пенза, ${street}, ${house}`,
    limit: 8,
  });

  return items
    .map(item => mapGeoSuggestAddressSuggestion(item, street))
    .filter((item): item is PenzaDeliveryAddressSuggestion => Boolean(item));
}

async function fetchGeoSuggestPenzaAddressLineSuggestions(query: string) {
  const normalizedQuery = normalizeAddressPart(query);
  if (!normalizedQuery) return [];

  const parsed = parsePenzaDeliveryAddressLine(normalizedQuery);
  const fallbackStreet = parsed.street || normalizedQuery;
  const items = await fetchYandexGeoSuggestItems({
    query: `Пенза, ${normalizedQuery}`,
    limit: 10,
  });

  return items
    .map(item => mapGeoSuggestAddressLineSuggestion(item, fallbackStreet))
    .filter((item): item is PenzaDeliveryAddressLineSuggestion => Boolean(item))
    .filter(item => areStreetNamesClose(fallbackStreet, item.street));
}

function dedupeAddressSuggestions(
  suggestions: PenzaDeliveryAddressSuggestion[],
) {
  const seen = new Set<string>();

  return suggestions.filter(item => {
    const key = [
      normalizeStreetName(item.street),
      normalizeHouseName(item.house),
      normalizeAddressPart(item.label).toLocaleLowerCase("ru"),
    ].join("|");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeStreetSuggestions(
  suggestions: PenzaDeliveryStreetSuggestion[],
) {
  const seen = new Set<string>();

  return suggestions.filter(item => {
    const key = normalizeStreetName(item.street);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
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
    const geoSuggestSuggestions = await fetchGeoSuggestPenzaAddressSuggestions(
      street,
      house,
    ).then(items =>
      items.filter(item => areStreetNamesClose(street, item.street)),
    );
    if (geoSuggestSuggestions.length > 0) {
      return dedupeAddressSuggestions(geoSuggestSuggestions);
    }

    const yandexSuggestions = await fetchYandexPenzaAddressSuggestions(
      street,
      house,
    ).then(items =>
      items.filter(item => areStreetNamesClose(street, item.street)),
    );
    if (yandexSuggestions.length > 0) {
      return dedupeAddressSuggestions(yandexSuggestions);
    }

    const payload = await fetchPenzaAddressCandidates(street, house);

    const nominatimSuggestions = payload
      .map(mapSuggestion)
      .filter((item): item is PenzaDeliveryAddressSuggestion => Boolean(item))
      .filter(item => areStreetNamesClose(street, item.street));

    return dedupeAddressSuggestions(nominatimSuggestions);
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
    const geoSuggestSuggestions = await fetchGeoSuggestPenzaStreetSuggestions(
      street,
    ).then(items =>
      items.filter(item =>
        areStreetNamesClose(street, item.street),
      ),
    );
    if (geoSuggestSuggestions.length > 0) {
      return dedupeStreetSuggestions(geoSuggestSuggestions);
    }

    const yandexSuggestions = await fetchYandexPenzaStreetSuggestions(street).then(
      items => items.filter(item => areStreetNamesClose(street, item.street)),
    );
    if (yandexSuggestions.length > 0) {
      return dedupeStreetSuggestions(yandexSuggestions);
    }

    const payload = await fetchPenzaStreetCandidates(street);

    const nominatimSuggestions = payload
      .map(mapStreetSuggestion)
      .filter((item): item is PenzaDeliveryStreetSuggestion => Boolean(item))
      .filter(item => areStreetNamesClose(street, item.street));

    return dedupeStreetSuggestions(nominatimSuggestions);
  } catch {
    return [];
  }
}

export async function searchPenzaDeliveryAddressLine(input: {
  query: string;
}): Promise<PenzaDeliveryAddressLineSuggestion[]> {
  const query = normalizeAddressPart(input.query);
  if (query.length < 2) return [];

  const parsed = parsePenzaDeliveryAddressLine(query);
  const suggestions: PenzaDeliveryAddressLineSuggestion[] = [];

  const geoSuggestLineSuggestions =
    await fetchGeoSuggestPenzaAddressLineSuggestions(query);

  if (geoSuggestLineSuggestions.length > 0) {
    suggestions.push(...geoSuggestLineSuggestions);
  }

  if (parsed.street && parsed.house && suggestions.length === 0) {
    const addresses = await searchPenzaDeliveryAddresses({
      street: parsed.street,
      house: parsed.house,
    });

    suggestions.push(
      ...addresses.map(item => ({
        label: item.label,
        addressLine: cleanPenzaSuggestionLabel(item.label),
        street: item.street,
        house: item.house,
        coordinates: item.coordinates,
        type: "address" as const,
        source: item.source,
      })),
    );
  }

  if (parsed.street && !parsed.house && suggestions.length === 0) {
    const streets = await searchPenzaDeliveryStreets({
      street: parsed.street,
    });

    suggestions.push(
      ...streets.map(item => {
        const label = buildPenzaLineLabel({
          label: item.label,
          street: item.street,
        });

        return {
          label,
          addressLine: label,
          street: item.street,
          house: "",
          coordinates: null,
          type: "street" as const,
          source: item.source,
        };
      }),
    );
  }

  const seen = new Set<string>();
  return suggestions
    .filter(item => {
      const key = [
        normalizeStreetName(item.street),
        normalizeHouseName(item.house),
        item.type,
        normalizeAddressPart(item.label).toLocaleLowerCase("ru"),
      ].join("|");
      if (!item.street || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

export async function validatePenzaDeliveryAddress(input: {
  street: string;
  house: string;
}): Promise<PenzaAddressValidationResult> {
  const street = normalizeAddressPart(input.street);
  const house = normalizeAddressPart(input.house);
  const query = `${street}, ${house}, Пенза`;

  try {
    const geoSuggestMatches = await fetchGeoSuggestPenzaAddressSuggestions(
      street,
      house,
    );
    const yandexMatches = await fetchYandexPenzaAddressSuggestions(street, house);
    const requestedHouse = normalizeHouseName(house);
    const geoSuggestMatch = geoSuggestMatches.find(item => {
      return (
        areStreetNamesClose(street, item.street) &&
        normalizeHouseName(item.house) === requestedHouse
      );
    });

    if (geoSuggestMatch) {
      return {
        ok: true,
        normalizedAddress: geoSuggestMatch.label,
        coordinates: geoSuggestMatch.coordinates,
      };
    }

    const yandexMatch = yandexMatches.find(item => {
      return (
        areStreetNamesClose(street, item.street) &&
        normalizeHouseName(item.house) === requestedHouse
      );
    });

    if (yandexMatch) {
      return {
        ok: true,
        normalizedAddress: yandexMatch.label,
        coordinates: yandexMatch.coordinates,
      };
    }

    const payload = await fetchPenzaAddressCandidates(street, house);

    const match = payload.find(item => {
      const mapped = mapSuggestion(item);

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
