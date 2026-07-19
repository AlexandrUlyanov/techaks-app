type ExportRow = Record<string, unknown>;

type AccountExportSource = {
  generatedAt?: Date;
  profile: ExportRow;
  addresses: ExportRow[];
  orders: ExportRow[];
  favorites: ExportRow[];
  securityEvents: ExportRow[];
};

const securityActionLabels: Record<string, string> = {
  profile_updated: "Профиль обновлён",
  email_change_requested: "Запрошена смена электронной почты",
  email_changed: "Электронная почта изменена",
  password_changed: "Пароль изменён",
  other_sessions_revoked: "Завершены другие сеансы",
  account_deactivated: "Кабинет деактивирован",
  account_deletion_requested: "Запрошено удаление аккаунта",
};

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function asDate(value: unknown) {
  return value instanceof Date || typeof value === "string" ? value : null;
}

/**
 * Customer exports use a strict allowlist. Never spread database rows here:
 * they contain provider identifiers, raw payloads and operational errors.
 */
export function buildAccountDataExport(source: AccountExportSource) {
  const profile = source.profile;

  return {
    generatedAt: source.generatedAt ?? new Date(),
    profile: {
      email: asString(profile.email),
      phone: asString(profile.phone),
      fullName: asString(profile.fullName),
      firstName: asString(profile.firstName),
      lastName: asString(profile.lastName),
      displayName: asString(profile.displayName),
      avatarUrl: asString(profile.avatarUrl),
      language: asString(profile.language),
      timezone: asString(profile.timezone),
      status: asString(profile.status),
      marketingConsent: asBoolean(profile.marketingConsent),
      marketingConsentAt: asDate(profile.marketingConsentAt),
      createdAt: asDate(profile.createdAt),
      updatedAt: asDate(profile.updatedAt),
    },
    loyalty: {
      status: asString(profile.loyaltyStatus),
      balance: asNumber(profile.loyaltyBalance),
      availableToSpend: asNumber(profile.loyaltyAvailableToSpend),
      pendingAccrual: asNumber(profile.loyaltyPendingAccrual),
      programName: asString(profile.loyaltyProgramName),
    },
    addresses: source.addresses.map(address => ({
      label: asString(address.label),
      recipientName: asString(address.recipientName),
      recipientPhone: asString(address.recipientPhone),
      country: asString(address.country),
      region: asString(address.region),
      city: asString(address.city),
      street: asString(address.street),
      house: asString(address.house),
      apartment: asString(address.apartment),
      postcode: asString(address.postcode),
      courierComment: asString(address.courierComment),
      isDefault: asBoolean(address.isDefault),
      createdAt: asDate(address.createdAt),
      updatedAt: asDate(address.updatedAt),
    })),
    orders: source.orders.map(order => ({
      orderNumber: asString(order.orderNumber),
      status: asString(order.status),
      createdAt: asDate(order.createdAt),
      updatedAt: asDate(order.updatedAt),
      totalPrice: asNumber(order.totalPrice),
      subtotal: asNumber(order.subtotal),
      discountTotal: asNumber(order.discountTotal),
      deliveryPrice: asNumber(order.deliveryPrice),
      paidAmount: asNumber(order.paidAmount),
      loyaltyBonusSpent: asNumber(order.loyaltyBonusSpent),
      loyaltyBonusAccrued: asNumber(order.loyaltyBonusAccrued),
      deliveryType: asString(order.deliveryType),
      deliveryStatus: asString(order.deliveryStatus),
      deliveryService: asString(order.deliveryService),
      deliveryCity: asString(order.deliveryCity),
      deliveryRegion: asString(order.deliveryRegion),
      deliveryPostalCode: asString(order.deliveryPostalCode),
      deliveryTrackNumber: asString(order.deliveryTrackNumber),
      deliveryComment: asString(order.deliveryComment),
      address: asString(order.address),
      shippedAt: asDate(order.shippedAt),
      deliveredAt: asDate(order.deliveredAt),
      paymentType: asString(order.paymentType),
      paymentStatus: asString(order.paymentStatus),
      paymentMethod: asString(order.paymentMethod),
      paidAt: asDate(order.paidAt),
      customerName: asString(order.customerName),
      customerPhone: asString(order.customerPhone),
      customerEmail: asString(order.customerEmail),
      customerComment: asString(order.customerComment),
      cancelledAt: asDate(order.cancelledAt),
      cancelledReason: asString(order.cancelledReason),
      completedAt: asDate(order.completedAt),
    })),
    favorites: source.favorites.map(favorite => {
      const productSlug = asString(favorite.productSlug);
      return {
        productName: asString(favorite.productName),
        productSlug,
        productUrl: productSlug
          ? `https://techaks.ru/product/${productSlug}`
          : null,
        addedAt: asDate(favorite.createdAt),
      };
    }),
    securityEvents: source.securityEvents.map(event => ({
      action:
        securityActionLabels[asString(event.action) ?? ""] ??
        "Действие с аккаунтом",
      createdAt: asDate(event.createdAt),
    })),
  };
}
