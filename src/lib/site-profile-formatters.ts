type SiteProfileLike = {
  contacts: {
    email?: string | null;
    primaryPhoneDisplay?: string | null;
  };
  seller: {
    legalForm?: "ip" | "ooo" | null;
    fullName?: string | null;
    legalAddress?: string | null;
    actualAddress?: string | null;
    inn?: string | null;
    ogrnip?: string | null;
    kpp?: string | null;
    okpo?: string | null;
  };
  bank: {
    bankName?: string | null;
    account?: string | null;
    corrAccount?: string | null;
    bik?: string | null;
    inn?: string | null;
    kpp?: string | null;
  };
  documents?: {
    signatureName?: string | null;
    signatureLabel?: string | null;
    requisitesFooter?: string | null;
  } | null;
};

export function getSellerRegistrationLabel(legalForm?: "ip" | "ooo" | null) {
  return legalForm === "ooo" ? "ОГРН" : "ОГРНИП";
}

export function buildSellerRequisitesLines(profile?: SiteProfileLike | null) {
  if (!profile) return [];

  return [
    profile.seller.fullName || null,
    profile.seller.legalAddress ? `Юр. адрес: ${profile.seller.legalAddress}` : null,
    profile.seller.actualAddress ? `Факт. адрес: ${profile.seller.actualAddress}` : null,
    profile.seller.inn ? `ИНН: ${profile.seller.inn}` : null,
    profile.seller.ogrnip
      ? `${getSellerRegistrationLabel(profile.seller.legalForm)}: ${profile.seller.ogrnip}`
      : null,
    profile.seller.kpp ? `КПП: ${profile.seller.kpp}` : null,
    profile.seller.okpo ? `ОКПО: ${profile.seller.okpo}` : null,
    profile.bank.bankName ? `Банк: ${profile.bank.bankName}` : null,
    profile.bank.account ? `р/с: ${profile.bank.account}` : null,
    profile.bank.corrAccount ? `к/с: ${profile.bank.corrAccount}` : null,
    profile.bank.bik ? `БИК: ${profile.bank.bik}` : null,
    profile.bank.inn ? `ИНН банка: ${profile.bank.inn}` : null,
    profile.bank.kpp ? `КПП банка: ${profile.bank.kpp}` : null,
    profile.contacts.email ? `E-mail: ${profile.contacts.email}` : null,
    profile.contacts.primaryPhoneDisplay
      ? `Телефон: ${profile.contacts.primaryPhoneDisplay}`
      : null,
  ].filter((line): line is string => Boolean(line && line.trim()));
}

export function buildSellerSignatureLine(profile?: SiteProfileLike | null) {
  if (!profile?.documents?.signatureLabel) return "";
  return `______________ ${profile.documents.signatureLabel}`;
}
