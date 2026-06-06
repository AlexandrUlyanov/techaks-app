import { MapPin } from "lucide-react";
import StoreCard from "@/components/StoreCard";
import { trpc } from "@/providers/trpc";
import { useSeo } from "@/lib/seo";
import {
  buildBreadcrumbStructuredData,
  getPublicSchemaAddress,
  buildOrganizationStructuredData,
  buildStoreStructuredData,
} from "@/lib/seo-structured";

export default function StoresPage() {
  const { data: siteProfile } = trpc.settings.getPublicSiteProfile.useQuery();
  const { data: stores = [] } = trpc.store.getAll.useQuery();

  const now = new Date();
  const isStoreOpen = now.getHours() >= 9 && now.getHours() < 21;

  useSeo({
    title: "Магазины ТЕХАКС в Пензе — адреса, телефоны и режим работы",
    description:
      "Адреса магазинов ТЕХАКС в Пензе, часы работы, телефоны, самовывоз и схема проезда.",
    canonicalPath: "/stores",
    structuredData: [
      buildBreadcrumbStructuredData([
        { name: "Главная", path: "/" },
        { name: "Магазины", path: "/stores" },
      ]),
      buildOrganizationStructuredData({
        name: "ТЕХАКС",
        url: "https://techaks.ru",
        logo: "https://techaks.ru/images/logo-light.svg",
        email: siteProfile?.contacts.email || "tech.aks@yandex.ru",
        phone: siteProfile?.contacts.primaryPhoneDisplay || "+7 (927) 364-28-88",
        address: getPublicSchemaAddress({
          shortAddress: siteProfile?.contacts.shortAddress,
          fullAddress: siteProfile?.contacts.fullAddress,
          legalAddress: siteProfile?.seller.legalAddress,
        }),
      }),
      ...stores.map(store => buildStoreStructuredData(store)),
    ],
  });

  return (
    <div className="min-h-screen pb-16 md:pb-0 bg-background text-foreground">
      {/* Hero */}
      <section className="relative py-20 md:py-32 overflow-hidden border-b border-border">
        <div className="absolute top-0 right-0 w-[40%] h-full bg-[#05C3D4]/5 blur-[100px] rounded-full" />
        <div className="container-main relative z-10">
          <span className="text-[#05C3D4] text-[10px] font-black uppercase tracking-[0.3em] mb-4 block">
            Локации
          </span>
          <h1 className="text-4xl md:text-6xl font-black uppercase font-heading leading-none tracking-tighter text-foreground">
            МАГАЗИНЫ <span className="text-muted-foreground/30">ТЕХАКС</span>
          </h1>
          <p className="mt-8 text-lg text-muted-foreground max-w-xl font-medium leading-relaxed">
            Два современных магазина в Пензе. Аккуратные витрины,
            профессиональная помощь и поклейка стекол на месте.
          </p>
        </div>
      </section>

      {/* Store Cards */}
      <section className="py-24 bg-card">
        <div className="container-main">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {stores.map(store => (
              <StoreCard
                key={store.id}
                name={store.name}
                address={store.address}
                hours={store.hours}
                phone={store.phone}
                rating={store.rating}
                reviews={`${store.reviewCount} оценок`}
                image={store.image}
                isOpen={isStoreOpen}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Map Section */}
      <section className="py-24 bg-background border-t border-border">
        <div className="container-main">
          <div className="text-center mb-16">
            <span className="text-[#05C3D4] text-[10px] font-black uppercase tracking-[0.3em] mb-3 block">
              Навигация
            </span>
            <h2 className="text-4xl md:text-5xl font-black uppercase font-heading leading-none tracking-tighter text-foreground">
              КАК <span className="text-muted-foreground/30">ДОБРАТЬСЯ</span>
            </h2>
          </div>

          <div className="relative group bg-card border border-border rounded-[2.5rem] h-[500px] flex items-center justify-center overflow-hidden shadow-sm">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5" />
            <div className="relative z-10 text-center px-6">
              <div className="w-20 h-20 rounded-2xl bg-foreground/5 flex items-center justify-center text-[#05C3D4] mx-auto mb-8 border border-border">
                <MapPin size={40} />
              </div>
              <p className="text-xl font-black uppercase font-heading text-foreground/20 tracking-[0.2em] mb-10">
                Интерактивная карта ТЕХАКС
              </p>
              <div className="flex flex-wrap justify-center gap-5">
                {stores.map(store => (
                  <a
                    key={store.id}
                    href={store.mapUrl || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-8 py-4 bg-background border border-border rounded-xl text-xs font-black uppercase tracking-widest text-foreground hover:bg-[#05C3D4] hover:text-white dark:hover:text-black hover:border-[#05C3D4] transition-all active:scale-95 shadow-xl"
                  >
                    <MapPin size={16} />
                    {store.name}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
