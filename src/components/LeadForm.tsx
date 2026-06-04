import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import PersonalDataConsent from "@/components/PersonalDataConsent";
import { trackLeadSubmit } from "@/lib/yandex-metrika";

interface LeadFormProps {
  title?: string;
  subtitle?: string;
  type?: "callback" | "availability" | "question" | "service";
  source?: string;
  metadata?: any;
  dark?: boolean;
  buttonText?: string;
}

export default function LeadForm({
  title = "НУЖНА ПОМОЩЬ С ВЫБОРОМ?",
  subtitle = "Оставьте номер — мы перезвоним и поможем подобрать аксессуар за 5 минут.",
  type = "callback",
  source = "website",
  metadata,
  dark = false,
  buttonText = "Заказать звонок",
}: LeadFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);

  const createLead = trpc.lead.create.useMutation({
    onSuccess: () => {
      trackLeadSubmit({
        formType: type,
        source,
      });
      toast.success("Спасибо! Мы свяжемся с вами в ближайшее время.");
      setName("");
      setPhone("");
      setMessage("");
      setConsentChecked(false);
    },
    onError: error => {
      toast.error(error.message || "Произошла ошибка. Попробуйте позже.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      toast.error("Пожалуйста, заполните имя и телефон");
      return;
    }
    if (!consentChecked) {
      toast.error("Подтвердите согласие на обработку персональных данных");
      return;
    }
    createLead.mutate({
      name: name.trim(),
      phone: phone.trim(),
      message: message.trim() || undefined,
      type,
      source,
      metadata: {
        ...(metadata && typeof metadata === "object" ? metadata : {}),
        consentToPersonalData: true,
        consentAt: new Date().toISOString(),
      },
    });
  };

  const inputBase =
    "w-full h-14 px-5 border rounded-xl text-sm font-bold outline-none transition-all placeholder:text-white/20";
  const inputClass = dark
    ? `${inputBase} bg-white/5 border-white/10 text-white focus:border-[#05C3D4] focus:bg-white/10`
    : `${inputBase} bg-black/5 border-black/10 text-black focus:border-black/30 placeholder:text-black/30`;

  return (
    <div
      className={
        dark
          ? "bg-[#15171A] border border-white/5 rounded-3xl p-10"
          : "bg-white/10 backdrop-blur-md border border-white/10 rounded-3xl p-10"
      }
    >
      <h3
        className={`text-2xl font-black font-heading uppercase tracking-tight leading-none ${dark ? "text-white" : "text-black"}`}
      >
        {title}
      </h3>
      <p
        className={`mt-4 text-sm font-bold ${dark ? "text-white/40" : "text-black/50"}`}
      >
        {subtitle}
      </p>

      <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-4">
        <input
          type="text"
          placeholder="Ваше имя"
          value={name}
          onChange={e => setName(e.target.value)}
          className={inputClass}
          required
        />
        <input
          type="tel"
          placeholder="Телефон"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          className={inputClass}
          required
        />
        <textarea
          placeholder="Сообщение (опционально)"
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={3}
          className={`${inputClass} py-4 h-auto resize-none`}
        />
        <PersonalDataConsent
          checked={consentChecked}
          onCheckedChange={setConsentChecked}
          dark={dark}
        />
        <button
          type="submit"
          disabled={createLead.isPending}
          className={`w-full h-14 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all glow-cyan active:scale-95 disabled:opacity-50 ${
            dark
              ? "bg-[#05C3D4] text-black hover:bg-[#27E6F2]"
              : "bg-black text-white hover:bg-black/90"
          }`}
        >
          {createLead.isPending ? "ОБРАБОТКА..." : buttonText.toUpperCase()}
        </button>
      </form>
    </div>
  );
}
