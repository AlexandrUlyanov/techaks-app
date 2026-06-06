import { useMemo } from "react";
import { useLocation } from "react-router";
import { trpc } from "@/providers/trpc";
import { useSeo } from "@/lib/seo";
import {
  buildBreadcrumbStructuredData,
  buildFaqStructuredData,
  buildOrganizationStructuredData,
  getPublicSchemaAddress,
} from "@/lib/seo-structured";
import {
  buildSellerRequisitesLines,
  getSellerRegistrationLabel,
} from "@/lib/site-profile-formatters";

type LegalDocumentKey = "offer" | "privacy-policy" | "payment-delivery" | "returns";
type LegalTextField =
  | "offerTitle"
  | "offerContent"
  | "privacyPolicyTitle"
  | "privacyPolicyContent"
  | "paymentDeliveryTitle"
  | "paymentDeliveryContent"
  | "returnsPolicyTitle"
  | "returnsPolicyContent";

const DOCUMENT_META: Record<
  LegalDocumentKey,
  {
    titleField: LegalTextField;
    contentField: LegalTextField;
    fallbackTitle: string;
    seoDescription: string;
  }
> = {
  offer: {
    titleField: "offerTitle",
    contentField: "offerContent",
    fallbackTitle: "Публичная оферта",
    seoDescription:
      "Публичная оферта интернет-магазина ТЕХАКС: условия заказа, оплаты, получения товара и взаимодействия с покупателем.",
  },
  "privacy-policy": {
    titleField: "privacyPolicyTitle",
    contentField: "privacyPolicyContent",
    fallbackTitle: "Политика обработки персональных данных",
    seoDescription:
      "Политика обработки персональных данных ТЕХАКС: какие данные собираются, как используются и как защищаются.",
  },
  "payment-delivery": {
    titleField: "paymentDeliveryTitle",
    contentField: "paymentDeliveryContent",
    fallbackTitle: "Оплата и доставка",
    seoDescription:
      "Оплата и доставка в ТЕХАКС: самовывоз, доставка по Пензе и России, способы оплаты и условия получения заказа.",
  },
  returns: {
    titleField: "returnsPolicyTitle",
    contentField: "returnsPolicyContent",
    fallbackTitle: "Возврат и обмен",
    seoDescription:
      "Возврат и обмен в ТЕХАКС: порядок обращения, условия возврата, обмена и поддержки по заказам интернет-магазина.",
  },
};

export default function LegalDocumentPage() {
  const location = useLocation();
  const { data: profile } = trpc.settings.getPublicSiteProfile.useQuery();

  const key = (location.pathname.replace(/^\//, "") || "offer") as LegalDocumentKey;
  const meta = DOCUMENT_META[key] ?? DOCUMENT_META.offer;
  const title = profile?.legalTexts[meta.titleField] || meta.fallbackTitle;
  const content = profile?.legalTexts[meta.contentField] || "";
  const seoDescription = meta.seoDescription;
  const sellerLines = buildSellerRequisitesLines(profile);
  const faqStructuredData =
    key === "payment-delivery"
      ? buildFaqStructuredData([
          {
            question: "Какие способы получения доступны в ТЕХАКС?",
            answer:
              "Интернет-магазин ТЕХАКС предлагает самовывоз и доставку. Доступность конкретного способа зависит от товара, региона и наличия.",
          },
          {
            question: "От чего зависят способы оплаты и доставки?",
            answer:
              "Итоговые варианты оплаты и получения зависят от выбранного товара, региона и статуса наличия. Они фиксируются в подтверждённом заказе.",
          },
        ])
      : key === "returns"
        ? buildFaqStructuredData([
            {
              question: "Как оформить возврат или обмен?",
              answer:
                "Для возврата или обмена нужно обратиться по контактам магазина и указать номер заказа, причину обращения и удобный способ связи.",
            },
            {
              question: "Какие данные могут понадобиться для возврата?",
              answer:
                "Менеджер может запросить фотографии, описание состояния товара и сведения о комплектности перед принятием решения по возврату или обмену.",
            },
          ])
        : null;

  useSeo({
    title: `${title} — ТЕХАКС`,
    description: seoDescription,
    canonicalPath: location.pathname,
    structuredData: [
      buildBreadcrumbStructuredData([
        { name: "Главная", url: "https://techaks.ru/" },
        { name: title, url: `https://techaks.ru${location.pathname}` },
      ]),
      buildOrganizationStructuredData({
        name: "ТЕХАКС",
        url: "https://techaks.ru",
        logo: "https://techaks.ru/images/logo-light.svg",
        email: profile?.contacts.email,
        phone: profile?.contacts.primaryPhoneDisplay,
        address: getPublicSchemaAddress({
          shortAddress: profile?.contacts.shortAddress,
          fullAddress: profile?.contacts.fullAddress,
          legalAddress: profile?.seller.legalAddress,
        }),
      }),
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: title,
        description: seoDescription,
        url: `https://techaks.ru${location.pathname}`,
      },
      ...(faqStructuredData ? [faqStructuredData] : []),
    ],
  });

  const sections = useMemo(
    () =>
      content
        .split(/\n{2,}/)
        .map(section => section.trim())
        .filter(Boolean),
    [content]
  );

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      <section className="border-b border-border bg-card/40">
        <div className="container-main py-16 md:py-20">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#05C3D4]">
            Правовая информация
          </span>
          <h1 className="mt-4 max-w-4xl text-4xl font-black uppercase tracking-tighter md:text-6xl">
            {title}
          </h1>
          <p className="mt-6 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
            Актуальная редакция текста управляется через настройки магазина. Ниже
            отображается текущая публичная версия документа.
          </p>
        </div>
      </section>

      <section className="container-main py-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <article className="rounded-3xl border border-border bg-card p-8 shadow-sm">
            {sections.length > 0 ? (
              <div className="space-y-6 text-sm leading-7 text-foreground/85 md:text-base">
                {sections.map((section, index) => (
                  <p key={`${index}-${section.slice(0, 20)}`} className="whitespace-pre-line">
                    {section}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Документ пока не заполнен в настройках сайта.
              </p>
            )}
          </article>

          <aside className="space-y-5">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#05C3D4]">
                Продавец
              </div>
              <div className="mt-4 space-y-2 text-sm text-foreground">
                <div className="font-black">{profile?.seller.fullName}</div>
                <div>{profile?.seller.legalAddress}</div>
                <div>ИНН: {profile?.seller.inn}</div>
                <div>
                  {getSellerRegistrationLabel(profile?.seller.legalForm)}:{" "}
                  {profile?.seller.ogrnip}
                </div>
                {profile?.seller.kpp ? <div>КПП: {profile.seller.kpp}</div> : null}
                {profile?.seller.okpo ? <div>ОКПО: {profile.seller.okpo}</div> : null}
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#05C3D4]">
                Реквизиты
              </div>
              <div className="mt-4 space-y-2 text-sm text-foreground">
                {sellerLines.map(line => (
                  <div key={line}>{line}</div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#05C3D4]">
                Контакты
              </div>
              <div className="mt-4 space-y-2 text-sm text-foreground">
                <div>{profile?.contacts.primaryPhoneDisplay}</div>
                <div>{profile?.contacts.email}</div>
                <div className="text-muted-foreground">{profile?.contacts.workingHours}</div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
