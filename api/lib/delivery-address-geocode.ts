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

function parseCoordinate(value: string | null | undefined) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
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

  if (!displayName || !containsPenza(displayName) || !street || !house) {
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

  if (!displayName || !containsPenza(displayName) || !street) {
    return null;
  }

  return {
    label: street,
    street,
  };
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

  const url = new URL(NOMINATIM_ENDPOINT);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "8");
  url.searchParams.set("countrycodes", "ru");
  url.searchParams.set("city", "Пенза");
  url.searchParams.set("street", `${house} ${street}`);
  url.searchParams.set("addressdetails", "1");

  try {
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

    const payload = (await response.json()) as Array<{
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
    }>;

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

  const url = new URL(NOMINATIM_ENDPOINT);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "10");
  url.searchParams.set("countrycodes", "ru");
  url.searchParams.set("city", "Пенза");
  url.searchParams.set("street", street);
  url.searchParams.set("addressdetails", "1");

  try {
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

    const payload = (await response.json()) as Array<{
      display_name?: string;
      address?: {
        city?: string;
        town?: string;
        village?: string;
        road?: string;
      };
    }>;

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

  const url = new URL(NOMINATIM_ENDPOINT);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "ru");
  url.searchParams.set("city", "Пенза");
  url.searchParams.set("street", `${house} ${street}`);
  url.searchParams.set("addressdetails", "1");

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "Accept-Language": "ru",
        "User-Agent": "TechaksCheckout/1.0 (support@techaks.ru)",
      },
    });

    if (!response.ok) {
      return {
        ok: false,
        message:
          "Не удалось подтвердить адрес доставки. Проверьте улицу и номер дома.",
      };
    }

    const payload = (await response.json()) as Array<{
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
    }>;

    const match = payload.find(item => {
      const mapped = mapSuggestion(item);
      const requestedHouse = normalizeHouseName(house);

      if (!mapped) return false;
      if (!areStreetNamesClose(street, mapped.street)) return false;
      if (normalizeHouseName(mapped.house) !== requestedHouse) return false;

      return true;
    });

    if (!match) {
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
