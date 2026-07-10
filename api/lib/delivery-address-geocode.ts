import { getYandexGeoSuggestRuntimeSettings } from "./yandex-delivery-settings";

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
const YANDEX_GEOSUGGEST_ENDPOINT = "https://suggest-maps.yandex.ru/v1/suggest";
const PENZA_BBOX = "44.75,53.10~45.15,53.32";
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
  coordinates?: [number, number] | null;
  point?: {
    pos?: string;
  };
  GeoObject?: {
    Point?: {
      pos?: string;
    };
  };
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

function parseYandexCoordinates(pos: string | null | undefined) {
  const [lon, lat] = normalizeAddressPart(pos)
    .split(/\s+/)
    .map(value => Number(value));

  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;

  return [lon, lat] as [number, number];
}

function getGeoSuggestCoordinates(item: YandexGeoSuggestItem) {
  if (
    Array.isArray(item.coordinates) &&
    item.coordinates.length === 2 &&
    item.coordinates.every(value => Number.isFinite(value))
  ) {
    return item.coordinates;
  }

  return (
    parseYandexCoordinates(item.point?.pos) ??
    parseYandexCoordinates(item.GeoObject?.Point?.pos)
  );
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
    coordinates: getGeoSuggestCoordinates(item),
    type: house ? "address" : "street",
    source: "geosuggest",
  };
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

export async function searchPenzaDeliveryAddressLine(input: {
  query: string;
}): Promise<PenzaDeliveryAddressLineSuggestion[]> {
  const query = normalizeAddressPart(input.query);
  if (query.length < 2) return [];

  const suggestions = await fetchGeoSuggestPenzaAddressLineSuggestions(query);

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
