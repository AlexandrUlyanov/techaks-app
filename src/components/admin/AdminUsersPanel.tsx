import { trpc } from "@/providers/trpc";
import { Loader2, UserCog } from "lucide-react";
import { useAbility } from "@/providers/AbilityProvider";

const ROLE_LABELS: Record<string, string> = {
  customer: "Покупатель",
  manager: "Менеджер (Заказы, Лиды)",
  content_manager: "Контент-менеджер",
  merchandiser: "Мерчандайзер",
  admin: "Администратор",
  super_admin: "Супер-Админ (Полный доступ)",
};

export default function AdminUsersPanel() {
  const utils = trpc.useUtils();
  const ability = useAbility();
  const { data: users, isLoading } = trpc.user.getAll.useQuery(undefined, {
    enabled: ability.can("read", "User"),
  });

  const updateRoleMutation = trpc.user.updateRole.useMutation({
    onSuccess: () => {
      utils.user.getAll.invalidate();
    },
    onError: err => {
      alert("Ошибка: " + err.message);
    },
  });

  const updateStatusMutation = trpc.user.updateStatus.useMutation({
    onSuccess: () => {
      utils.user.getAll.invalidate();
    },
    onError: err => {
      alert("Ошибка: " + err.message);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 px-6 py-10 text-sm text-gray-500">
        <Loader2 size={18} className="animate-spin" />
        Загрузка пользователей...
      </div>
    );
  }

  if (!users) return null;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-6 py-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-[#15171A] flex items-center gap-2">
            <UserCog size={20} className="text-[#05C3D4]" />
            Управление ролями
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Здесь вы можете назначить права администратора, менеджера или мерчандайзера другим сотрудникам.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-gray-50 uppercase text-gray-400 text-[10px] font-black tracking-widest">
            <tr>
              <th className="px-6 py-4">ID</th>
              <th className="px-6 py-4">Пользователь</th>
              <th className="px-6 py-4">Роль</th>
              <th className="px-6 py-4">Статус</th>
              <th className="px-6 py-4">Регистрация</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4 font-mono text-gray-400">#{user.id}</td>
                <td className="px-6 py-4">
                  <div className="font-bold text-[#15171A]">{user.phone}</div>
                  <div className="text-gray-500 text-xs mt-0.5">{user.fullName || "Имя не указано"}</div>
                </td>
                <td className="px-6 py-4">
                  <select
                    value={user.role}
                    onChange={e => {
                      if (confirm(`Вы уверены, что хотите изменить роль для ${user.phone}?`)) {
                        updateRoleMutation.mutate({ id: user.id, role: e.target.value });
                      }
                    }}
                    disabled={updateRoleMutation.isPending || !ability.can("manage", "User")}
                    className="h-9 w-full min-w-[200px] rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4] disabled:opacity-50"
                  >
                    {Object.entries(ROLE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-4">
                  <select
                    value={user.status}
                    onChange={e => {
                      if (confirm(`Вы уверены, что хотите изменить статус для ${user.phone}?`)) {
                        updateStatusMutation.mutate({ id: user.id, status: e.target.value as "active" | "disabled" });
                      }
                    }}
                    disabled={updateStatusMutation.isPending || !ability.can("manage", "User")}
                    className={`h-9 rounded-lg border px-3 text-sm outline-none focus:border-[#05C3D4] disabled:opacity-50 ${
                      user.status === "active" ? "border-green-200 text-green-700 bg-green-50" : "border-red-200 text-red-700 bg-red-50"
                    }`}
                  >
                    <option value="active">Активен</option>
                    <option value="disabled">Заблокирован</option>
                  </select>
                </td>
                <td className="px-6 py-4 text-gray-500">
                  {new Date(user.createdAt).toLocaleDateString("ru-RU")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
