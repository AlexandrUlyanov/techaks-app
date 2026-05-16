import { useState, useEffect } from "react";
import { trpc } from "@/providers/trpc";
import { 
  Loader2, 
  Save, 
  BellRing, 
  Mail, 
  Database, 
  Globe 
} from "lucide-react";

export default function AdminAuthSettingsPanel() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.settings.getAuthSettings.useQuery();

  const [vapidPublicKey, setVapidPublicKey] = useState("");
  const [vapidPrivateKey, setVapidPrivateKey] = useState("");
  const [vapidSubject, setVapidSubject] = useState("");
  
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");

  useEffect(() => {
    if (data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVapidPublicKey(data.vapidPublicKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVapidPrivateKey("");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVapidSubject(data.vapidSubject);
      
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSmtpHost(data.smtpHost);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSmtpPort(data.smtpPort);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSmtpUser(data.smtpUser);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSmtpPass("");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSmtpFrom(data.smtpFrom);
    }
  }, [data]);

  const saveMutation = trpc.settings.saveAuthSettings.useMutation({
    onSuccess: () => {
      utils.settings.getAuthSettings.invalidate();
      alert("Настройки авторизации сохранены!");
      setVapidPrivateKey("");
      setSmtpPass("");
    },
    onError: err => alert("Ошибка: " + err.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 px-6 py-10 text-sm text-gray-500 bg-white rounded-2xl border border-gray-200">
        <Loader2 size={18} className="animate-spin" />
        Загрузка настроек авторизации...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Web Push Section */}
      <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="border-b border-gray-100 px-6 py-5 bg-gray-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#05C3D4]/10 flex items-center justify-center text-[#05C3D4]">
              <BellRing size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#15171A]">Push-уведомления браузера</h2>
              <p className="text-xs text-gray-500">Ключи VAPID для авторизации без СМС</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-gray-200 shadow-sm">
            {data?.source.vapid === "database" ? (
              <>
                <Database size={12} className="text-[#05C3D4]" />
                <span className="text-[10px] font-black uppercase text-[#05C3D4]">База данных</span>
              </>
            ) : (
              <>
                <Globe size={12} className="text-gray-400" />
                <span className="text-[10px] font-black uppercase text-gray-400">Переменные среды</span>
              </>
            )}
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#15171A] uppercase tracking-wider">Публичный ключ</label>
            <input
              type="text"
              value={vapidPublicKey}
              onChange={e => setVapidPublicKey(e.target.value)}
              placeholder="BCKWu4rcJHLXH9Jo..."
              className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4] font-mono text-xs"
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#15171A] uppercase tracking-wider">Приватный ключ</label>
              <input
                type="password"
                value={vapidPrivateKey}
                onChange={e => setVapidPrivateKey(e.target.value)}
                placeholder={data?.hasVapidPrivateKey ? "••••••••••••••••" : "Введите приватный ключ"}
                className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4] font-mono"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#15171A] uppercase tracking-wider">Адрес отправителя VAPID</label>
              <input
                type="text"
                value={vapidSubject}
                onChange={e => setVapidSubject(e.target.value)}
                placeholder="mailto:admin@domain.ru"
                className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Секция резервной почтовой отправки */}
      <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="border-b border-gray-100 px-6 py-5 bg-gray-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#05C3D4]/10 flex items-center justify-center text-[#05C3D4]">
              <Mail size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#15171A]">Резервная почтовая отправка (SMTP)</h2>
              <p className="text-xs text-gray-500">Настройки для отправки одноразовых кодов</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-gray-200 shadow-sm">
            {data?.source.smtp === "database" ? (
              <>
                <Database size={12} className="text-[#05C3D4]" />
                <span className="text-[10px] font-black uppercase text-[#05C3D4]">База данных</span>
              </>
            ) : (
              <>
                <Globe size={12} className="text-gray-400" />
                <span className="text-[10px] font-black uppercase text-gray-400">Переменные среды</span>
              </>
            )}
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid gap-5 md:grid-cols-3">
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold text-[#15171A] uppercase tracking-wider">SMTP-сервер</label>
              <input
                type="text"
                value={smtpHost}
                onChange={e => setSmtpHost(e.target.value)}
                placeholder="smtp.yandex.ru"
                className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#15171A] uppercase tracking-wider">Порт</label>
              <input
                type="text"
                value={smtpPort}
                onChange={e => setSmtpPort(e.target.value)}
                placeholder="465"
                className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
              />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#15171A] uppercase tracking-wider">Логин / электронная почта</label>
              <input
                type="text"
                value={smtpUser}
                onChange={e => setSmtpUser(e.target.value)}
                placeholder="login@yandex.ru"
                className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#15171A] uppercase tracking-wider">Пароль</label>
              <input
                type="password"
                value={smtpPass}
                onChange={e => setSmtpPass(e.target.value)}
                placeholder={data?.hasSmtpPass ? "••••••••••••••••" : "Пароль приложения"}
                className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
              />
            </div>
          </div>

          <div className="space-y-2">
              <label className="text-xs font-bold text-[#15171A] uppercase tracking-wider">От кого</label>
            <input
              type="text"
              value={smtpFrom}
              onChange={e => setSmtpFrom(e.target.value)}
              placeholder="TechAks <no-reply@techaks.ru>"
              className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
            />
          </div>
        </div>

        <div className="p-6 pt-0">
          <button
            onClick={() => saveMutation.mutate({
              vapidPublicKey,
              vapidPrivateKey,
              vapidSubject,
              smtpHost,
              smtpPort,
              smtpUser,
              smtpPass,
              smtpFrom,
            })}
            disabled={saveMutation.isPending}
            className="w-full inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-black text-white px-6 text-sm font-black uppercase tracking-widest disabled:opacity-50 hover:bg-[#05C3D4] hover:text-black transition-all shadow-lg glow-cyan-hover"
          >
            {saveMutation.isPending ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            Сохранить все настройки авторизации
          </button>
        </div>
      </section>
    </div>
  );
}
