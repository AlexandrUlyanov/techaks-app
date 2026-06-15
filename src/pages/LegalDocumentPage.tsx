import { useMemo } from "react";
import { Link, useLocation } from "react-router";
import {
  ArrowRight,
  Building2,
  Clock3,
  CreditCard,
  FileText,
  MapPin,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";

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

const LEGAL_LINKS: Array<{
  key: LegalDocumentKey;
  href: string;
  shortLabel: string;
}> = [
  { key: "payment-delivery", href: "/payment-delivery", shortLabel: "Оплата и доставка" },
  { key: "returns", href: "/returns", shortLabel: "Возврат" },
  { key: "offer", href: "/offer", shortLabel: "Оферта" },
  { key: "privacy-policy", href: "/privacy-policy", shortLabel: "Персональные данные" },
];

const DOCUMENT_CONTEXT: Record<
  LegalDocumentKey,
  {
    eyebrow: string;
    intro: string;
    highlights: string[];
    sidebarTitle: string;
    sidebarDescription: string;
  }
> = {
  offer: {
    eyebrow: "Договор и условия",
    intro:
      "На этой странице собраны правила оформления заказа, оплаты, получения товара и взаимодействия между покупателем и магазином.",
    highlights: [
      "Условия заказа и подтверждения покупки",
      "Порядок оплаты, самовывоза и получения товара",
      "Права и обязанности покупателя и продавца",
    ],
    sidebarTitle: "Что обычно смотрят в оферте",
    sidebarDescription:
      "Проверьте условия оформления заказа, способы получения и данные продавца перед покупкой.",
  },
  "privacy-policy": {
    eyebrow: "Данные и безопасность",
    intro:
      "Здесь описано, какие персональные данные использует ТЕХАКС, для чего они нужны и как магазин обеспечивает их защиту.",
    highlights: [
      "Какие данные собираются и зачем",
      "Как обрабатываются заявки, заказы и обращения",
      "Как связаться по вопросам персональных данных",
    ],
    sidebarTitle: "Что важно пользователю",
    sidebarDescription:
      "На странице легко проверить, как магазин работает с персональными данными и куда писать по вопросам обработки.",
  },
  "payment-delivery": {
    eyebrow: "Получение заказа",
    intro:
      "Актуальные условия оплаты, самовывоза и доставки для заказов в ТЕХАКС. Финальные варианты подтверждаются на этапе оформления заказа.",
    highlights: [
      "Самовывоз из магазинов при доступном наличии",
      "Доставка по Пензе и России в зависимости от товара",
      "Способы оплаты зависят от сценария получения и заказа",
    ],
    sidebarTitle: "На что обратить внимание",
    sidebarDescription:
      "Способ оплаты и получения зависит от товара, наличия и города. Подтверждённый сценарий всегда фиксируется в заказе.",
  },
  returns: {
    eyebrow: "Возврат и поддержка",
    intro:
      "На странице собран порядок обращения по возврату, обмену и гарантийным вопросам, а также контакты, через которые это можно оформить.",
    highlights: [
      "Как обратиться по возврату или обмену",
      "Какие данные и документы могут понадобиться",
      "Как быстро связаться с магазином по заказу",
    ],
    sidebarTitle: "Как ускорить обращение",
    sidebarDescription:
      "Подготовьте номер заказа, причину обращения и фотографии товара, если менеджер попросит уточнение по состоянию и комплектности.",
  },
};

function getStoresSummary(count: number) {
  if (count <= 0) return "Магазины и точки самовывоза уточняются";
  if (count === 1) return "1 точка самовывоза";
  if (count >= 2 && count <= 4) return `${count} точки самовывоза`;
  return `${count} точек самовывоза`;
}

export default function LegalDocumentPage() {
  const location = useLocation();
  const { data: profile } = trpc.settings.getPublicSiteProfile.useQuery();
  const { data: stores = [] } = trpc.store.getAll.useQuery();

  const key = (location.pathname.replace(/^\//, "") || "offer") as LegalDocumentKey;
  const meta = DOCUMENT_META[key] ?? DOCUMENT_META.offer;
  const context = DOCUMENT_CONTEXT[key] ?? DOCUMENT_CONTEXT.offer;
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
  const leadSection = sections[0] ?? "";
  const detailSections = leadSection ? sections.slice(1) : sections;
  const relatedLinks = LEGAL_LINKS.filter(link => link.key !== key);
  const phone = profile?.contacts.primaryPhoneDisplay || "+7 (927) 364-28-88";
  const email = profile?.contacts.email || "tech.aks@yandex.ru";
  const workingHours = profile?.contacts.workingHours || "Ежедневно 9:00–21:00";
  const shortAddress =
    profile?.contacts.shortAddress ||
    profile?.contacts.fullAddress ||
    profile?.seller.legalAddress ||
    "Пенза";

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      <section className="border-b border-border bg-card/40">
        <div className="container-main py-16 md:py-20">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#05C3D4]">
            {context.eyebrow}
          </span>
          <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tighter md:text-6xl">
            {title}
          </h1>
          <p className="mt-6 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
            {context.intro}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {context.highlights.map(highlight => (
              <span
                key={highlight}
                className="inline-flex rounded-full bg-[color:color-mix(in_srgb,var(--tech-color-primary)_10%,transparent)] px-4 py-2 text-xs font-bold text-foreground/82"
              >
                {highlight}
              </span>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {relatedLinks.map(link => (
              <Link
                key={link.href}
                to={link.href}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-bold text-muted-foreground transition-colors hover:border-[var(--tech-color-primary)] hover:text-foreground"
              >
                {link.shortLabel}
                <ArrowRight size={14} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="container-main py-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <article className="space-y-6 rounded-3xl border border-border bg-card p-8">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl bg-[var(--tech-color-surface)] p-5">
                <div className="flex items-center gap-3 text-sm font-black text-foreground">
                  <MapPin size={18} className="text-[#05C3D4]" />
                  Самовывоз
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {getStoresSummary(stores.length)}. Актуальный выбор точки доступен в оформлении заказа.
                </p>
              </div>
              <div className="rounded-3xl bg-[var(--tech-color-surface)] p-5">
                <div className="flex items-center gap-3 text-sm font-black text-foreground">
                  <CreditCard size={18} className="text-[#05C3D4]" />
                  Оплата
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Наличными, картой при получении или онлайн — итоговый способ зависит от сценария заказа.
                </p>
              </div>
              <div className="rounded-3xl bg-[var(--tech-color-surface)] p-5">
                <div className="flex items-center gap-3 text-sm font-black text-foreground">
                  <ShieldCheck size={18} className="text-[#05C3D4]" />
                  Поддержка
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  По гарантийным и организационным вопросам можно быстро связаться с магазином.
                </p>
              </div>
            </div>

            {leadSection ? (
              <div className="rounded-3xl bg-[var(--tech-color-surface)] p-6">
                <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[#05C3D4]">
                  Коротко
                </div>
                <p className="mt-4 whitespace-pre-line text-sm leading-7 text-foreground/90 md:text-base">
                  {leadSection}
                </p>
              </div>
            ) : null}

            {sections.length > 0 ? (
              <div className="space-y-6 text-sm leading-7 text-foreground/85 md:text-base">
                {detailSections.map((section, index) => (
                  <div
                    key={`${index}-${section.slice(0, 20)}`}
                    className="rounded-3xl bg-[var(--tech-color-surface)] px-6 py-5"
                  >
                    <p className="whitespace-pre-line">{section}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Документ пока не заполнен в настройках сайта.
              </p>
            )}
          </article>

          <aside className="space-y-5">
            <div className="rounded-3xl border border-border bg-card p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:color-mix(in_srgb,var(--tech-color-primary)_12%,transparent)] text-[#05C3D4]">
                  <FileText size={20} />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#05C3D4]">
                    {context.sidebarTitle}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {context.sidebarDescription}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6">
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

            <div className="rounded-3xl border border-border bg-card p-6">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#05C3D4]">
                Реквизиты
              </div>
              <div className="mt-4 space-y-2 text-sm text-foreground">
                {sellerLines.map(line => (
                  <div key={line}>{line}</div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#05C3D4]">
                Контакты
              </div>
              <div className="mt-4 space-y-2 text-sm text-foreground">
                <div className="font-bold">{phone}</div>
                <div>{email}</div>
                <div className="text-muted-foreground">{workingHours}</div>
                <div className="text-muted-foreground">{shortAddress}</div>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#05C3D4]">
                Быстрые действия
              </div>
              <div className="mt-4 space-y-3">
                <Button asChild variant="outline" className="w-full justify-between">
                  <Link to="/contacts">
                    Связаться с магазином
                    <ArrowRight size={16} />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-between">
                  <Link to="/payment-delivery">
                    Оплата и доставка
                    <CreditCard size={16} />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-between">
                  <Link to="/returns">
                    Возврат и обмен
                    <RefreshCcw size={16} />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-between">
                  <Link to="/about">
                    О компании
                    <Building2 size={16} />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#05C3D4]">
                Магазин на связи
              </div>
              <div className="mt-4 flex items-start gap-3 text-sm text-foreground">
                <Clock3 size={18} className="mt-1 shrink-0 text-[#05C3D4]" />
                <div className="leading-6 text-muted-foreground">
                  <div className="font-semibold text-foreground">{workingHours}</div>
                  <div>Самовывоз и консультация доступны в рабочие часы магазина.</div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
