import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";

interface LeadFormProps {
  title?: string;
  subtitle?: string;
  type?: "callback" | "availability" | "question" | "service";
  source?: string;
  dark?: boolean;
  buttonText?: string;
}

export default function LeadForm({
  title = "Нужна помощь с выбором?",
  subtitle = "Оставьте номер — мы перезвоним и поможем подобрать аксессуар",
  type = "callback",
  source = "website",
  dark = false,
  buttonText = "Заказать звонок",
}: LeadFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  const createLead = trpc.lead.create.useMutation({
    onSuccess: () => {
      toast.success("Спасибо! Мы свяжемся с вами в ближайшее время.");
      setName("");
      setPhone("");
      setMessage("");
    },
    onError: (error) => {
      toast.error(error.message || "Произошла ошибка. Попробуйте позже.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      toast.error("Пожалуйста, заполните имя и телефон");
      return;
    }
    createLead.mutate({
      name: name.trim(),
      phone: phone.trim(),
      message: message.trim() || undefined,
      type,
      source,
    });
  };

  const inputBase =
    "w-full h-12 px-4 border rounded-lg text-base outline-none transition-all focus:ring-2 focus:ring-[rgba(0,188,212,0.15)] placeholder:text-gray-500";
  const inputClass = dark
    ? `${inputBase} bg-[#001a1f] border-[#004d5c] text-white placeholder:text-gray-400 focus:border-[#00bcd4]`
    : `${inputBase} bg-white border-gray-200 text-[#0a0a0a] placeholder:text-gray-400 focus:border-[#00bcd4]`;

  return (
    <div className={dark ? "bg-[#00252b] rounded-xl p-8" : "bg-gray-50 rounded-xl p-8"}>
      <h3
        className={`text-xl font-bold ${dark ? "text-white" : "text-[#0a0a0a]"}`}
      >
        {title}
      </h3>
      <p
        className={`mt-2 text-sm ${dark ? "text-gray-400" : "text-gray-500"}`}
      >
        {subtitle}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <input
          type="text"
          placeholder="Ваше имя"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          required
        />
        <input
          type="tel"
          placeholder="Телефон"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={inputClass}
          required
        />
        <textarea
          placeholder="Сообщение (опционально)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          className={`${inputClass} py-3 h-auto resize-none`}
        />
        <button
          type="submit"
          disabled={createLead.isPending}
          className="w-full h-12 bg-[#00bcd4] text-white rounded-lg text-sm font-semibold hover:bg-[#00838f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ boxShadow: "0 2px 8px rgba(0,188,212,0.35)" }}
        >
          {createLead.isPending ? "Отправка..." : buttonText}
        </button>
      </form>

      <p
        className={`mt-4 text-xs text-center ${dark ? "text-gray-500" : "text-gray-400"}`}
      >
        Нажимая кнопку, вы соглашаетесь с политикой обработки персональных данных
      </p>
    </div>
  );
}
