import { useState, useEffect } from "react";
import { trpc } from "@/providers/trpc";
import { Loader2, Save, User as UserIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const ROLE_LABELS: Record<string, string> = {
  customer: "Покупатель",
  manager: "Менеджер (Заказы, Лиды)",
  content_manager: "Контент-менеджер",
  merchandiser: "Мерчандайзер",
  admin: "Администратор",
  super_admin: "Супер-Админ (Полный доступ)",
};

export default function AdminProfilePanel() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || "");
      setPhone(user.phone || "");
    }
  }, [user]);

  const updateProfileMutation = trpc.user.updateProfile.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      alert("Профиль успешно обновлен!");
    },
    onError: err => {
      alert("Ошибка: " + err.message);
    },
  });

  if (!user) return null;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-6 py-5">
        <h2 className="text-lg font-black text-[#15171A] flex items-center gap-2">
          <UserIcon size={20} className="text-[#05C3D4]" />
          Мой Профиль
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Ваши личные данные и роль в системе.
        </p>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-bold text-[#15171A]">Email (Логин)</label>
            <div className="flex h-11 items-center rounded-lg border border-gray-200 px-3 text-sm text-gray-500 bg-gray-50">
              {user.email}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-[#15171A]">Ваша Роль</label>
            <div className="flex h-11 items-center rounded-lg border border-gray-200 px-3 text-sm text-[#05C3D4] font-black bg-[#05C3D4]/5">
              {ROLE_LABELS[user.role] || user.role}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-[#15171A]">ФИО</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Иван Иванов"
              className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-[#15171A]">Телефон (для связи)</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+7 (___) ___-__-__"
              className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
            />
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={() => updateProfileMutation.mutate({ fullName, phone })}
            disabled={updateProfileMutation.isPending || (fullName === (user.fullName || "") && phone === (user.phone || ""))}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#05C3D4] px-6 text-sm font-black text-black disabled:opacity-50 hover:bg-[#04b0c0] transition-colors"
          >
            {updateProfileMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            Сохранить профиль
          </button>
        </div>
      </div>
    </section>
  );
}
