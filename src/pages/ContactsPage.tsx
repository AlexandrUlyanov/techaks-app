import { Phone, Mail, MapPin, Send } from "lucide-react";
import LeadForm from "@/components/LeadForm";
import { trpc } from "@/providers/trpc";

export default function ContactsPage() {
  const { data: siteProfile } = trpc.settings.getPublicSiteProfile.useQuery();
  const { data: stores = [] } = trpc.store.getAll.useQuery();

  return (
    <div className="min-h-screen pb-16 md:pb-0 bg-background text-foreground">
      {/* Hero */}
      <section className="relative py-20 md:py-32 overflow-hidden border-b border-white/5">
        <div className="absolute top-0 right-0 w-[40%] h-full bg-[#05C3D4]/5 blur-[100px] rounded-full" />
        <div className="container-main relative z-10">
          <span className="text-[#05C3D4] text-[10px] font-black uppercase tracking-[0.3em] mb-4 block">
            Связь
          </span>
          <h1 className="text-4xl md:text-6xl font-black uppercase font-heading leading-none tracking-tighter text-white">
            КОНТАКТЫ <span className="text-white/20">ТЕХАКС</span>
          </h1>
          <p className="mt-8 text-lg text-white/40 max-w-xl font-medium leading-relaxed">
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
                <div className="w-14 h-14 rounded-2xl bg-[#05C3D4]/10 border border-[#05C3D4]/20 flex items-center justify-center text-[#05C3D4] group-hover:bg-[#05C3D4] group-hover:text-black transition-all duration-300">
                  <Phone size={24} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-2 block">
                    Телефон
                  </span>
                  <a
                    href={`tel:${(siteProfile?.contacts.primaryPhone || "").replace(/\s+/g, "")}`}
                    className="text-2xl md:text-3xl font-black text-white hover:text-[#05C3D4] transition-colors font-heading tracking-tight"
                  >
                    {siteProfile?.contacts.primaryPhoneDisplay || "+7 (927) 364-28-88"}
                  </a>
                  <p className="mt-2 text-sm font-bold text-white/40 uppercase tracking-widest">
                    {siteProfile?.contacts.workingHours || "Ежедневно 9:00–21:00"}
                  </p>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-start gap-6 group">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-white/30 group-hover:border-[#05C3D4]/40 group-hover:text-[#05C3D4] transition-all duration-300">
                  <Mail size={24} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-2 block">
                    E-mail
                  </span>
                  <span className="text-xl md:text-2xl font-bold text-white/80">
                    {siteProfile?.contacts.email || "tech.aks@yandex.ru"}
                  </span>
                </div>
              </div>

              {/* Telegram */}
              <div className="flex items-start gap-6 group">
                <div className="w-14 h-14 rounded-2xl bg-[#0088cc]/10 border border-[#0088cc]/20 flex items-center justify-center text-[#0088cc] group-hover:bg-[#0088cc] group-hover:text-white transition-all duration-300">
                  <Send size={24} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-2 block">
                    Telegram
                  </span>
                  <a
                    href={siteProfile?.contacts.telegramUrl || "https://t.me/tech_aks"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xl md:text-2xl font-bold text-white/80 hover:text-[#0088cc] transition-colors"
                  >
                    {siteProfile?.contacts.telegramHandle || "@tech_aks"}
                  </a>
                </div>
              </div>

              {/* Addresses */}
              <div className="pt-12 border-t border-white/5 space-y-8">
                <div className="flex items-start gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-white/20">
                    <MapPin size={24} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
                    {stores.length > 0 ? (
                      stores.map(store => (
                        <div key={store.id}>
                          <p className="text-[10px] font-black uppercase tracking-widest text-[#05C3D4] mb-2">
                            {store.name}
                          </p>
                          <p className="text-lg font-bold text-white/80 leading-tight">
                            {store.address}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#05C3D4] mb-2">
                          Юридический адрес
                        </p>
                        <p className="text-lg font-bold text-white/80 leading-tight">
                          {siteProfile?.seller.legalAddress ||
                            "442963, Пензенская область, г. Заречный, ул. Ленина, д.6, кв.12"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-12 border-t border-white/5 space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">
                  Реквизиты продавца
                </h3>
                <div className="rounded-3xl border border-white/5 bg-white/5 p-6">
                  <div className="space-y-2 text-sm leading-6 text-white/70">
                    <p className="font-black text-white">{siteProfile?.seller.fullName}</p>
                    <p>Юр. адрес: {siteProfile?.seller.legalAddress}</p>
                    <p>Факт. адрес: {siteProfile?.seller.actualAddress}</p>
                    <p>ИНН: {siteProfile?.seller.inn}</p>
                    <p>
                      {siteProfile?.seller.legalForm === "ip" ? "ОГРНИП" : "ОГРН"}:{" "}
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
              <div className="pt-12 border-t border-white/5">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 mb-6">
                  Быстрые сообщения
                </h3>
                <div className="flex flex-wrap gap-4">
                  <a
                    href={siteProfile?.contacts.telegramUrl || "https://t.me/tech_aks"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-8 py-4 bg-white/5 border border-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#0088cc] hover:border-[#0088cc] transition-all active:scale-95"
                  >
                    Telegram
                  </a>
                  <a
                    href={siteProfile?.contacts.whatsappUrl || "https://wa.me/79273642888"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-8 py-4 bg-white/5 border border-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#25d366] hover:border-[#25d366] transition-all active:scale-95"
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
                  dark
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
