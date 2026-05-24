import { Phone, Mail, MapPin, Send } from "lucide-react";
import LeadForm from "@/components/LeadForm";
import { trpc } from "@/providers/trpc";

export default function ContactsPage() {
  const { data: siteProfile } = trpc.settings.getPublicSiteProfile.useQuery();
  const { data: stores = [] } = trpc.store.getAll.useQuery();
  const legalFormLabel =
    siteProfile?.seller.legalForm === "ip" ? "ОГРНИП" : "ОГРН";

  return (
    <div className="min-h-screen pb-16 md:pb-0 bg-background text-foreground">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border py-20 md:py-32">
        <div className="absolute top-0 right-0 w-[40%] h-full bg-[#05C3D4]/5 blur-[100px] rounded-full" />
        <div className="container-main relative z-10">
          <span className="text-[#05C3D4] text-[10px] font-black uppercase tracking-[0.3em] mb-4 block">
            Связь
          </span>
          <h1 className="text-4xl md:text-6xl font-black uppercase font-heading leading-none tracking-tighter text-foreground">
            КОНТАКТЫ <span className="text-muted-foreground/30">ТЕХАКС</span>
          </h1>
          <p className="mt-8 max-w-xl text-lg font-medium leading-relaxed text-muted-foreground">
            Мы на связи ежедневно. Выбирайте удобный способ общения или заходите
            в гости.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-24">
        <div className="container-main">
          <div className="flex flex-col lg:flex-row gap-16 lg:gap-24">
            {/* Left - Contacts */}
            <div className="flex-1 space-y-12">
              {/* Phone */}
              <div className="flex items-start gap-6 group">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[color:color-mix(in_srgb,var(--tech-color-primary)_22%,transparent)] bg-[color:color-mix(in_srgb,var(--tech-color-primary)_10%,var(--tech-color-surface))] text-[#05C3D4] transition-all duration-300 group-hover:bg-[#05C3D4] group-hover:text-black">
                  <Phone size={24} />
                </div>
                <div>
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Телефон
                  </span>
                  <a
                    href={`tel:${(siteProfile?.contacts.primaryPhone || "").replace(/\s+/g, "")}`}
                    className="font-heading text-2xl font-black tracking-tight text-foreground transition-colors hover:text-[#05C3D4] md:text-3xl"
                  >
                    {siteProfile?.contacts.primaryPhoneDisplay || "+7 (927) 364-28-88"}
                  </a>
                  <p className="mt-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">
                    {siteProfile?.contacts.workingHours || "Ежедневно 9:00–21:00"}
                  </p>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-start gap-6 group">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-[var(--tech-color-surface)] text-muted-foreground transition-all duration-300 group-hover:border-[#05C3D4]/40 group-hover:text-[#05C3D4]">
                  <Mail size={24} />
                </div>
                <div>
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    E-mail
                  </span>
                  <span className="text-xl font-bold text-foreground md:text-2xl">
                    {siteProfile?.contacts.email || "tech.aks@yandex.ru"}
                  </span>
                </div>
              </div>

              {/* Telegram */}
              <div className="flex items-start gap-6 group">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#0088cc]/20 bg-[#0088cc]/10 text-[#0088cc] transition-all duration-300 group-hover:bg-[#0088cc] group-hover:text-white">
                  <Send size={24} />
                </div>
                <div>
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Telegram
                  </span>
                  <a
                    href={siteProfile?.contacts.telegramUrl || "https://t.me/tech_aks"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xl font-bold text-foreground transition-colors hover:text-[#0088cc] md:text-2xl"
                  >
                    {siteProfile?.contacts.telegramHandle || "@tech_aks"}
                  </a>
                </div>
              </div>

              {/* Addresses */}
              <div className="space-y-8 border-t border-border pt-12">
                <div className="flex items-start gap-6">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-[var(--tech-color-surface)] text-muted-foreground">
                    <MapPin size={24} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
                    {stores.length > 0 ? (
                      stores.map(store => (
                        <div key={store.id}>
                          <p className="text-[10px] font-black uppercase tracking-widest text-[#05C3D4] mb-2">
                            {store.name}
                          </p>
                          <p className="text-lg font-bold leading-tight text-foreground">
                            {store.address}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#05C3D4] mb-2">
                          Юридический адрес
                        </p>
                        <p className="text-lg font-bold leading-tight text-foreground">
                          {siteProfile?.seller.legalAddress ||
                            "442963, Пензенская область, г. Заречный, ул. Ленина, д.6, кв.12"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t border-border pt-12">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                  Реквизиты продавца
                </h3>
                <div className="rounded-3xl border border-border bg-[var(--tech-color-surface)] p-6">
                  <div className="space-y-2 text-sm leading-6 text-muted-foreground">
                    <p className="font-black text-foreground">{siteProfile?.seller.fullName}</p>
                    <p>Юр. адрес: {siteProfile?.seller.legalAddress}</p>
                    <p>Факт. адрес: {siteProfile?.seller.actualAddress}</p>
                    <p>ИНН: {siteProfile?.seller.inn}</p>
                    <p>
                      {legalFormLabel}:{" "}
                      {siteProfile?.seller.ogrnip}
                    </p>
                    {siteProfile?.seller.kpp ? <p>КПП: {siteProfile.seller.kpp}</p> : null}
                    {siteProfile?.seller.okpo ? <p>ОКПО: {siteProfile.seller.okpo}</p> : null}
                    <p>Банк: {siteProfile?.bank.bankName}</p>
                    <p>р/с: {siteProfile?.bank.account}</p>
                    <p>к/с: {siteProfile?.bank.corrAccount}</p>
                    <p>БИК: {siteProfile?.bank.bik}</p>
                  </div>
                </div>
              </div>

              {/* Messengers */}
              <div className="border-t border-border pt-12">
                <h3 className="mb-6 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                  Быстрые сообщения
                </h3>
                <div className="flex flex-wrap gap-4">
                  <a
                    href={siteProfile?.contacts.telegramUrl || "https://t.me/tech_aks"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border border-border bg-[var(--tech-color-surface)] px-8 py-4 text-[10px] font-black uppercase tracking-widest text-foreground transition-all active:scale-95 hover:border-[#0088cc] hover:bg-[#0088cc] hover:text-white"
                  >
                    Telegram
                  </a>
                  <a
                    href={siteProfile?.contacts.whatsappUrl || "https://wa.me/79273642888"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border border-border bg-[var(--tech-color-surface)] px-8 py-4 text-[10px] font-black uppercase tracking-widest text-foreground transition-all active:scale-95 hover:border-[#25d366] hover:bg-[#25d366] hover:text-white"
                  >
                    WhatsApp
                  </a>
                </div>
              </div>
            </div>

            {/* Right - Form */}
            <div className="flex-1 lg:max-w-[450px]">
              <div className="sticky top-28">
                <LeadForm
                  title="ОБРАТНАЯ СВЯЗЬ"
                  subtitle="Оставьте сообщение — мы ответим вам в течение 15 минут."
                  type="question"
                  source="contacts"
                  buttonText="ОТПРАВИТЬ"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
