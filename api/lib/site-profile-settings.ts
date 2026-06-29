import { getAppSettings, setAppSetting } from "./app-settings";

export type SiteContactSettings = {
  primaryPhone: string;
  primaryPhoneDisplay: string;
  secondaryPhone: string;
  email: string;
  workingHours: string;
  shortAddress: string;
  fullAddress: string;
};

export type SellerProfileSettings = {
  legalForm: "ip" | "ooo";
  fullName: string;
  shortName: string;
  signatoryName: string;
  signatoryLabel: string;
  signatoryBasis: string;
  legalAddress: string;
  actualAddress: string;
  inn: string;
  ogrnip: string;
  kpp: string;
  okpo: string;
  email: string;
  phone: string;
};

export type SellerBankSettings = {
  bankName: string;
  account: string;
  corrAccount: string;
  bik: string;
  inn: string;
  kpp: string;
};

export type SiteLegalTextSettings = {
  offerTitle: string;
  offerContent: string;
  privacyPolicyTitle: string;
  privacyPolicyContent: string;
  paymentDeliveryTitle: string;
  paymentDeliveryContent: string;
  returnsPolicyTitle: string;
  returnsPolicyContent: string;
};

export type SiteDocumentSettings = {
  signatureName: string;
  signatureLabel: string;
  requisitesFooter: string;
};

export type SiteProfileSettings = {
  contacts: SiteContactSettings;
  seller: SellerProfileSettings;
  bank: SellerBankSettings;
  legalTexts: SiteLegalTextSettings;
  documents: SiteDocumentSettings;
};

export type PublicSiteProfile = {
  contacts: SiteContactSettings;
  seller: Pick<
    SellerProfileSettings,
    | "legalForm"
    | "fullName"
    | "shortName"
    | "legalAddress"
    | "actualAddress"
    | "inn"
    | "ogrnip"
    | "kpp"
    | "okpo"
    | "email"
    | "phone"
  >;
  bank: SellerBankSettings;
  documents: SiteDocumentSettings;
  legalTexts: SiteLegalTextSettings;
};

export type SiteEmailBranding = {
  siteName: string;
  tagline: string;
  siteUrl: string;
  supportEmail: string;
  logoUrl: string;
  accountUrl: string;
  adminOrdersUrl: string;
};

export const defaultSiteProfileSettings: SiteProfileSettings = {
  contacts: {
    primaryPhone: "+7 (927) 364-28-88",
    primaryPhoneDisplay: "+7 (927) 364-28-88",
    secondaryPhone: "+7 (927) 364-28-88 (доб.3)",
    email: "tech.aks@yandex.ru",
    workingHours: "Ежедневно 9:00–21:00",
    shortAddress: "Пенза",
    fullAddress: "440039, Пензенская область, г. Пенза, ул. Ленина, д. 7",
  },
  seller: {
    legalForm: "ip",
    fullName: "Индивидуальный предприниматель Асташкина Татьяна Алексеевна",
    shortName: "ИП Асташкина Т.А.",
    signatoryName: "Асташкина Татьяна Алексеевна",
    signatoryLabel: "Асташкина Т.А.",
    signatoryBasis: "Индивидуальный предприниматель",
    legalAddress:
      "442963, Пензенская область, г. Заречный, ул. Ленина, д.6, кв.12",
    actualAddress:
      "442963, Пензенская область, г. Заречный, ул. Ленина, д.6, кв.12",
    inn: "583800160003",
    ogrnip: "325580000028444",
    kpp: "",
    okpo: "01929672",
    email: "tech.aks@yandex.ru",
    phone: "+7 (927) 364-28-88",
  },
  bank: {
    bankName: "Банк ВТБ (ПАО)",
    account: "40802810200810092221",
    corrAccount: "30101810145250000411",
    bik: "044525411",
    inn: "7702070139",
    kpp: "770943002",
  },
  legalTexts: {
    offerTitle: "Публичная оферта",
    offerContent:
      "Интернет-магазин ТЕХАКС размещает настоящую публичную оферту о продаже товаров дистанционным способом.\n\nПродавец: Индивидуальный предприниматель Асташкина Татьяна Алексеевна.\nИНН: 583800160003.\nОГРНИП: 325580000028444.\nЮридический адрес: 442963, Пензенская область, г. Заречный, ул. Ленина, д.6, кв.12.\nФактический адрес: 442963, Пензенская область, г. Заречный, ул. Ленина, д.6, кв.12.\nКонтактный email: tech.aks@yandex.ru.\nТелефон: +7 (927) 364-28-88.\n\nОформление заказа на сайте означает согласие покупателя с условиями продажи, доставки, оплаты и возврата товара. Актуальные характеристики, цена, наличие и условия выдачи товара указываются в карточке товара и в оформленном заказе.\n\nПродавец вправе связаться с покупателем для подтверждения заказа, состава, способа получения и оплаты.",
    privacyPolicyTitle: "Политика обработки персональных данных",
    privacyPolicyContent:
      "Настоящая политика определяет порядок обработки персональных данных пользователей сайта ТЕХАКС.\n\nОператор персональных данных: Индивидуальный предприниматель Асташкина Татьяна Алексеевна, ИНН 583800160003, ОГРНИП 325580000028444.\nКонтакты оператора: tech.aks@yandex.ru, +7 (927) 364-28-88.\n\nМы обрабатываем персональные данные только в объёме, необходимом для оформления заказов, связи с клиентом, доставки, возврата, отправки сервисных уведомлений и исполнения требований законодательства.\n\nПользователь соглашается с обработкой предоставленных данных при регистрации, оформлении заказа, отправке формы обратной связи и использовании личного кабинета.\n\nПо вопросам обработки персональных данных пользователь может обратиться по указанным контактам.",
    paymentDeliveryTitle: "Оплата и доставка",
    paymentDeliveryContent:
      "Интернет-магазин ТЕХАКС предлагает самовывоз и доставку в соответствии с условиями, указанными при оформлении заказа.\n\nДоступные способы оплаты и доставки зависят от выбранного товара, региона и статуса наличия. Итоговые условия оплаты, сумма заказа и адрес выдачи фиксируются в подтверждённом заказе.\n\nЕсли по товару требуется дополнительное подтверждение наличия или срока поставки, менеджер связывается с покупателем до окончательного подтверждения заказа.",
    returnsPolicyTitle: "Возврат и обмен",
    returnsPolicyContent:
      "Возврат и обмен товаров, приобретённых в интернет-магазине ТЕХАКС, осуществляются в соответствии с законодательством Российской Федерации и условиями конкретной категории товара.\n\nДля оформления возврата или обмена покупатель должен обратиться по контактам магазина, указав номер заказа, причину обращения и способ обратной связи.\n\nПри необходимости менеджер запрашивает фотографии, описание состояния товара и сведения о комплектности. Решение по возврату, обмену или сервисной проверке принимается после проверки товара и документов по заказу.",
  },
  documents: {
    signatureName: "Асташкина Татьяна Алексеевна",
    signatureLabel: "Асташкина Т.А.",
    requisitesFooter:
      "ИП Асташкина Татьяна Алексеевна • ИНН 583800160003 • ОГРНИП 325580000028444",
  },
};

const settingsKeyMap = {
  "contacts.primaryPhone": "site_contact_phone",
  "contacts.primaryPhoneDisplay": "site_contact_phone_display",
  "contacts.secondaryPhone": "site_contact_phone_secondary",
  "contacts.email": "site_contact_email",
  "contacts.workingHours": "site_contact_working_hours",
  "contacts.shortAddress": "site_contact_address_short",
  "contacts.fullAddress": "site_contact_address_full",
  "seller.legalForm": "seller_legal_form",
  "seller.fullName": "seller_full_name",
  "seller.shortName": "seller_short_name",
  "seller.signatoryName": "seller_signatory_name",
  "seller.signatoryLabel": "seller_signatory_label",
  "seller.signatoryBasis": "seller_signatory_basis",
  "seller.legalAddress": "seller_legal_address",
  "seller.actualAddress": "seller_actual_address",
  "seller.inn": "seller_inn",
  "seller.ogrnip": "seller_ogrnip",
  "seller.kpp": "seller_kpp",
  "seller.okpo": "seller_okpo",
  "seller.email": "seller_email",
  "seller.phone": "seller_phone",
  "bank.bankName": "seller_bank_name",
  "bank.account": "seller_bank_account",
  "bank.corrAccount": "seller_bank_corr_account",
  "bank.bik": "seller_bank_bik",
  "bank.inn": "seller_bank_inn",
  "bank.kpp": "seller_bank_kpp",
  "legalTexts.offerTitle": "offer_title",
  "legalTexts.offerContent": "offer_content",
  "legalTexts.privacyPolicyTitle": "privacy_policy_title",
  "legalTexts.privacyPolicyContent": "privacy_policy_content",
  "legalTexts.paymentDeliveryTitle": "payment_delivery_title",
  "legalTexts.paymentDeliveryContent": "payment_delivery_content",
  "legalTexts.returnsPolicyTitle": "returns_policy_title",
  "legalTexts.returnsPolicyContent": "returns_policy_content",
  "documents.signatureName": "documents_signature_name",
  "documents.signatureLabel": "documents_signature_label",
  "documents.requisitesFooter": "documents_requisites_footer",
} as const;

const allSettingKeys = Object.values(settingsKeyMap);

function normalizeText(value: string | null | undefined, fallback: string) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : fallback;
}

export async function getSiteProfileSettings(): Promise<SiteProfileSettings> {
  const values = await getAppSettings([...allSettingKeys]);

  return {
    contacts: {
      primaryPhone: normalizeText(
        values[settingsKeyMap["contacts.primaryPhone"]],
        defaultSiteProfileSettings.contacts.primaryPhone
      ),
      primaryPhoneDisplay: normalizeText(
        values[settingsKeyMap["contacts.primaryPhoneDisplay"]],
        defaultSiteProfileSettings.contacts.primaryPhoneDisplay
      ),
      secondaryPhone: normalizeText(
        values[settingsKeyMap["contacts.secondaryPhone"]],
        defaultSiteProfileSettings.contacts.secondaryPhone
      ),
      email: normalizeText(
        values[settingsKeyMap["contacts.email"]],
        defaultSiteProfileSettings.contacts.email
      ),
      workingHours: normalizeText(
        values[settingsKeyMap["contacts.workingHours"]],
        defaultSiteProfileSettings.contacts.workingHours
      ),
      shortAddress: normalizeText(
        values[settingsKeyMap["contacts.shortAddress"]],
        defaultSiteProfileSettings.contacts.shortAddress
      ),
      fullAddress: normalizeText(
        values[settingsKeyMap["contacts.fullAddress"]],
        defaultSiteProfileSettings.contacts.fullAddress
      ),
    },
    seller: {
      legalForm:
        normalizeText(
          values[settingsKeyMap["seller.legalForm"]],
          defaultSiteProfileSettings.seller.legalForm
        ) === "ooo"
          ? "ooo"
          : "ip",
      fullName: normalizeText(
        values[settingsKeyMap["seller.fullName"]],
        defaultSiteProfileSettings.seller.fullName
      ),
      shortName: normalizeText(
        values[settingsKeyMap["seller.shortName"]],
        defaultSiteProfileSettings.seller.shortName
      ),
      signatoryName: normalizeText(
        values[settingsKeyMap["seller.signatoryName"]],
        defaultSiteProfileSettings.seller.signatoryName
      ),
      signatoryLabel: normalizeText(
        values[settingsKeyMap["seller.signatoryLabel"]],
        defaultSiteProfileSettings.seller.signatoryLabel
      ),
      signatoryBasis: normalizeText(
        values[settingsKeyMap["seller.signatoryBasis"]],
        defaultSiteProfileSettings.seller.signatoryBasis
      ),
      legalAddress: normalizeText(
        values[settingsKeyMap["seller.legalAddress"]],
        defaultSiteProfileSettings.seller.legalAddress
      ),
      actualAddress: normalizeText(
        values[settingsKeyMap["seller.actualAddress"]],
        defaultSiteProfileSettings.seller.actualAddress
      ),
      inn: normalizeText(
        values[settingsKeyMap["seller.inn"]],
        defaultSiteProfileSettings.seller.inn
      ),
      ogrnip: normalizeText(
        values[settingsKeyMap["seller.ogrnip"]],
        defaultSiteProfileSettings.seller.ogrnip
      ),
      kpp: values[settingsKeyMap["seller.kpp"]]?.trim() || "",
      okpo: values[settingsKeyMap["seller.okpo"]]?.trim() || defaultSiteProfileSettings.seller.okpo,
      email: normalizeText(
        values[settingsKeyMap["seller.email"]],
        defaultSiteProfileSettings.seller.email
      ),
      phone: normalizeText(
        values[settingsKeyMap["seller.phone"]],
        defaultSiteProfileSettings.seller.phone
      ),
    },
    bank: {
      bankName: normalizeText(
        values[settingsKeyMap["bank.bankName"]],
        defaultSiteProfileSettings.bank.bankName
      ),
      account: normalizeText(
        values[settingsKeyMap["bank.account"]],
        defaultSiteProfileSettings.bank.account
      ),
      corrAccount: normalizeText(
        values[settingsKeyMap["bank.corrAccount"]],
        defaultSiteProfileSettings.bank.corrAccount
      ),
      bik: normalizeText(
        values[settingsKeyMap["bank.bik"]],
        defaultSiteProfileSettings.bank.bik
      ),
      inn: normalizeText(
        values[settingsKeyMap["bank.inn"]],
        defaultSiteProfileSettings.bank.inn
      ),
      kpp: normalizeText(
        values[settingsKeyMap["bank.kpp"]],
        defaultSiteProfileSettings.bank.kpp
      ),
    },
    legalTexts: {
      offerTitle: normalizeText(
        values[settingsKeyMap["legalTexts.offerTitle"]],
        defaultSiteProfileSettings.legalTexts.offerTitle
      ),
      offerContent: normalizeText(
        values[settingsKeyMap["legalTexts.offerContent"]],
        defaultSiteProfileSettings.legalTexts.offerContent
      ),
      privacyPolicyTitle: normalizeText(
        values[settingsKeyMap["legalTexts.privacyPolicyTitle"]],
        defaultSiteProfileSettings.legalTexts.privacyPolicyTitle
      ),
      privacyPolicyContent: normalizeText(
        values[settingsKeyMap["legalTexts.privacyPolicyContent"]],
        defaultSiteProfileSettings.legalTexts.privacyPolicyContent
      ),
      paymentDeliveryTitle: normalizeText(
        values[settingsKeyMap["legalTexts.paymentDeliveryTitle"]],
        defaultSiteProfileSettings.legalTexts.paymentDeliveryTitle
      ),
      paymentDeliveryContent: normalizeText(
        values[settingsKeyMap["legalTexts.paymentDeliveryContent"]],
        defaultSiteProfileSettings.legalTexts.paymentDeliveryContent
      ),
      returnsPolicyTitle: normalizeText(
        values[settingsKeyMap["legalTexts.returnsPolicyTitle"]],
        defaultSiteProfileSettings.legalTexts.returnsPolicyTitle
      ),
      returnsPolicyContent: normalizeText(
        values[settingsKeyMap["legalTexts.returnsPolicyContent"]],
        defaultSiteProfileSettings.legalTexts.returnsPolicyContent
      ),
    },
    documents: {
      signatureName: normalizeText(
        values[settingsKeyMap["documents.signatureName"]],
        defaultSiteProfileSettings.documents.signatureName
      ),
      signatureLabel: normalizeText(
        values[settingsKeyMap["documents.signatureLabel"]],
        defaultSiteProfileSettings.documents.signatureLabel
      ),
      requisitesFooter: normalizeText(
        values[settingsKeyMap["documents.requisitesFooter"]],
        defaultSiteProfileSettings.documents.requisitesFooter
      ),
    },
  };
}

export async function saveSiteProfileSettings(input: SiteProfileSettings) {
  const writes = [
    setAppSetting(settingsKeyMap["contacts.primaryPhone"], input.contacts.primaryPhone.trim()),
    setAppSetting(
      settingsKeyMap["contacts.primaryPhoneDisplay"],
      input.contacts.primaryPhoneDisplay.trim()
    ),
    setAppSetting(settingsKeyMap["contacts.secondaryPhone"], input.contacts.secondaryPhone.trim()),
    setAppSetting(settingsKeyMap["contacts.email"], input.contacts.email.trim()),
    setAppSetting(settingsKeyMap["contacts.workingHours"], input.contacts.workingHours.trim()),
    setAppSetting(settingsKeyMap["contacts.shortAddress"], input.contacts.shortAddress.trim()),
    setAppSetting(settingsKeyMap["contacts.fullAddress"], input.contacts.fullAddress.trim()),
    setAppSetting(settingsKeyMap["seller.legalForm"], input.seller.legalForm.trim()),
    setAppSetting(settingsKeyMap["seller.fullName"], input.seller.fullName.trim()),
    setAppSetting(settingsKeyMap["seller.shortName"], input.seller.shortName.trim()),
    setAppSetting(settingsKeyMap["seller.signatoryName"], input.seller.signatoryName.trim()),
    setAppSetting(settingsKeyMap["seller.signatoryLabel"], input.seller.signatoryLabel.trim()),
    setAppSetting(settingsKeyMap["seller.signatoryBasis"], input.seller.signatoryBasis.trim()),
    setAppSetting(settingsKeyMap["seller.legalAddress"], input.seller.legalAddress.trim()),
    setAppSetting(settingsKeyMap["seller.actualAddress"], input.seller.actualAddress.trim()),
    setAppSetting(settingsKeyMap["seller.inn"], input.seller.inn.trim()),
    setAppSetting(settingsKeyMap["seller.ogrnip"], input.seller.ogrnip.trim()),
    setAppSetting(settingsKeyMap["seller.kpp"], input.seller.kpp.trim()),
    setAppSetting(settingsKeyMap["seller.okpo"], input.seller.okpo.trim()),
    setAppSetting(settingsKeyMap["seller.email"], input.seller.email.trim()),
    setAppSetting(settingsKeyMap["seller.phone"], input.seller.phone.trim()),
    setAppSetting(settingsKeyMap["bank.bankName"], input.bank.bankName.trim()),
    setAppSetting(settingsKeyMap["bank.account"], input.bank.account.trim()),
    setAppSetting(settingsKeyMap["bank.corrAccount"], input.bank.corrAccount.trim()),
    setAppSetting(settingsKeyMap["bank.bik"], input.bank.bik.trim()),
    setAppSetting(settingsKeyMap["bank.inn"], input.bank.inn.trim()),
    setAppSetting(settingsKeyMap["bank.kpp"], input.bank.kpp.trim()),
    setAppSetting(settingsKeyMap["legalTexts.offerTitle"], input.legalTexts.offerTitle.trim()),
    setAppSetting(
      settingsKeyMap["legalTexts.offerContent"],
      input.legalTexts.offerContent.trim()
    ),
    setAppSetting(
      settingsKeyMap["legalTexts.privacyPolicyTitle"],
      input.legalTexts.privacyPolicyTitle.trim()
    ),
    setAppSetting(
      settingsKeyMap["legalTexts.privacyPolicyContent"],
      input.legalTexts.privacyPolicyContent.trim()
    ),
    setAppSetting(
      settingsKeyMap["legalTexts.paymentDeliveryTitle"],
      input.legalTexts.paymentDeliveryTitle.trim()
    ),
    setAppSetting(
      settingsKeyMap["legalTexts.paymentDeliveryContent"],
      input.legalTexts.paymentDeliveryContent.trim()
    ),
    setAppSetting(
      settingsKeyMap["legalTexts.returnsPolicyTitle"],
      input.legalTexts.returnsPolicyTitle.trim()
    ),
    setAppSetting(
      settingsKeyMap["legalTexts.returnsPolicyContent"],
      input.legalTexts.returnsPolicyContent.trim()
    ),
    setAppSetting(
      settingsKeyMap["documents.signatureName"],
      input.documents.signatureName.trim()
    ),
    setAppSetting(
      settingsKeyMap["documents.signatureLabel"],
      input.documents.signatureLabel.trim()
    ),
    setAppSetting(
      settingsKeyMap["documents.requisitesFooter"],
      input.documents.requisitesFooter.trim()
    ),
  ];

  await Promise.all(writes);
  return { success: true };
}

export async function getPublicSiteProfile() {
  const profile = await getSiteProfileSettings();

  return {
    contacts: profile.contacts,
    seller: {
      legalForm: profile.seller.legalForm,
      fullName: profile.seller.fullName,
      shortName: profile.seller.shortName,
      legalAddress: profile.seller.legalAddress,
      actualAddress: profile.seller.actualAddress,
      inn: profile.seller.inn,
      ogrnip: profile.seller.ogrnip,
      kpp: profile.seller.kpp,
      okpo: profile.seller.okpo,
      email: profile.seller.email,
      phone: profile.seller.phone,
    },
    bank: profile.bank,
    documents: profile.documents,
    legalTexts: profile.legalTexts,
  } satisfies PublicSiteProfile;
}

export async function getSiteEmailBranding(): Promise<SiteEmailBranding> {
  const profile = await getSiteProfileSettings();
  return {
    siteName: "ТЕХАКС",
    tagline: "Техника и аксессуары",
    siteUrl: "https://techaks.ru",
    supportEmail: profile.contacts.email || profile.seller.email || "tech.aks@yandex.ru",
    logoUrl: "https://techaks.ru/images/logo-light.svg",
    accountUrl: "https://techaks.ru/account",
    adminOrdersUrl: "https://techaks.ru/admin/leads",
  };
}

export function buildSellerRequisitesLines(profile: PublicSiteProfile) {
  const ogrnLabel = profile.seller.legalForm === "ip" ? "ОГРНИП" : "ОГРН";
  const lines = [
    profile.seller.fullName,
    `Юр. адрес: ${profile.seller.legalAddress}`,
    `Факт. адрес: ${profile.seller.actualAddress}`,
    `ИНН: ${profile.seller.inn}`,
    `${ogrnLabel}: ${profile.seller.ogrnip}`,
    profile.seller.kpp ? `КПП: ${profile.seller.kpp}` : null,
    profile.seller.okpo ? `ОКПО: ${profile.seller.okpo}` : null,
    `Банк: ${profile.bank.bankName}`,
    `р/с: ${profile.bank.account}`,
    `к/с: ${profile.bank.corrAccount}`,
    `БИК: ${profile.bank.bik}`,
    profile.bank.inn ? `ИНН банка: ${profile.bank.inn}` : null,
    profile.bank.kpp ? `КПП банка: ${profile.bank.kpp}` : null,
    `E-mail: ${profile.contacts.email || profile.seller.email}`,
    `Телефон: ${profile.contacts.primaryPhoneDisplay || profile.seller.phone}`,
  ];

  return lines.filter((line): line is string => Boolean(line && line.trim()));
}

export function buildSellerSignatureLine(profile: PublicSiteProfile) {
  return `${profile.documents.signatureName}\n______________${profile.documents.signatureLabel}`;
}
