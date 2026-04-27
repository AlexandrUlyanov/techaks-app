import { Phone, Mail, MapPin, Clock, Send } from "lucide-react";
import LeadForm from "@/components/LeadForm";

export default function ContactsPage() {
  return (
    <div className="min-h-screen pb-16 md:pb-0">
      {/* Hero */}
      <section className="bg-gray-50 py-12">
        <div className="container-main text-center">
          <h1 className="text-3xl md:text-5xl font-extrabold text-[#0a0a0a]">
            Контакты
          </h1>
          <p className="mt-3 text-base text-gray-600">
            Свяжитесь с нами удобным способом
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16">
        <div className="container-main">
          <div className="flex flex-col lg:flex-row gap-12">
            {/* Left - Contacts */}
            <div className="flex-1">
              {/* Phone */}
              <div className="flex items-start gap-4">
                <Phone size={24} className="text-[#00bcd4] mt-1" />
                <div>
                  <a
                    href="tel:+79273750555"
                    className="text-xl md:text-2xl font-bold text-[#0a0a0a] hover:text-[#00bcd4] transition-colors"
                  >
                    +7 (927) 375-05-55
                  </a>
                  <p className="mt-1 text-sm text-gray-500">Ежедневно 9:00–21:00</p>
                </div>
              </div>

              {/* Email */}
              <div className="mt-8 flex items-start gap-4">
                <Mail size={24} className="text-[#00bcd4] mt-1" />
                <div>
                  <span className="text-xl font-semibold text-[#0a0a0a]">info@techaks.ru</span>
                </div>
              </div>

              {/* Telegram */}
              <div className="mt-8 flex items-start gap-4">
                <Send size={24} className="text-[#00bcd4] mt-1" />
                <div>
                  <a
                    href="https://t.me/tech_aks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xl font-semibold text-[#0a0a0a] hover:text-[#00bcd4] transition-colors"
                  >
                    @tech_aks
                  </a>
                </div>
              </div>

              {/* Addresses */}
              <div className="mt-8 space-y-4">
                <div className="flex items-start gap-4">
                  <MapPin size={24} className="text-[#00bcd4] mt-1" />
                  <div>
                    <p className="font-semibold text-[#0a0a0a]">Магазин 1</p>
                    <p className="text-gray-500">пр. Строителей, 50А</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <MapPin size={24} className="text-[#00bcd4] mt-1" />
                  <div>
                    <p className="font-semibold text-[#0a0a0a]">Магазин 2</p>
                    <p className="text-gray-500">ул. Генерала Глазунова, 1 (ТЦ Застава)</p>
                  </div>
                </div>
              </div>

              {/* Hours */}
              <div className="mt-8 flex items-start gap-4">
                <Clock size={24} className="text-[#00bcd4] mt-1" />
                <div>
                  <p className="font-semibold text-[#0a0a0a]">Часы работы</p>
                  <p className="text-gray-500">Ежедневно 9:00–21:00</p>
                </div>
              </div>

              {/* Messengers */}
              <div className="mt-10">
                <h3 className="text-lg font-semibold text-[#0a0a0a]">Напишите нам</h3>
                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href="https://t.me/tech_aks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-3 bg-[#0088cc] text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                  >
                    Telegram
                  </a>
                  <a
                    href="#"
                    className="px-5 py-3 bg-[#4c75a3] text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                  >
                    VKontakte
                  </a>
                  <a
                    href="https://wa.me/79273750555"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-3 bg-[#25d366] text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                  >
                    WhatsApp
                  </a>
                </div>
              </div>
            </div>

            {/* Right - Form */}
            <div className="flex-1">
              <LeadForm
                title="Обратная связь"
                subtitle="Оставьте заявку — мы ответим в течение 15 минут"
                type="question"
                source="contacts"
                buttonText="Отправить сообщение"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
