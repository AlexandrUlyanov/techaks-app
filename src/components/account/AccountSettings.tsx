import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Download, ImagePlus, KeyRound, Loader2, LogOut, MapPin, Plus, Save, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/use-auth";

type Section = "profile" | "addresses" | "security" | "notifications" | "privacy";

const sections: Array<{ id: Section; label: string; icon: typeof UserRound }> = [
  { id: "profile", label: "Личные данные", icon: UserRound },
  { id: "addresses", label: "Адреса", icon: MapPin },
  { id: "security", label: "Безопасность", icon: ShieldCheck },
  { id: "notifications", label: "Уведомления", icon: Bell },
  { id: "privacy", label: "Данные и приватность", icon: Download },
];

const inputClass = "h-12 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors focus:border-[#05C3D4]";
const labelClass = "mb-2 block text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground";

export default function AccountSettings() {
  const [section, setSection] = useState<Section>("profile");
  const { setUser, user, logout, token } = useAuth();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarPending, setAvatarPending] = useState(false);
  const [emailConfirmationHandled, setEmailConfirmationHandled] = useState(false);
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.account.overview.useQuery();
  const [profile, setProfile] = useState({ firstName: "", lastName: "", displayName: "", phone: "", language: "ru", timezone: "Europe/Moscow" });
  const [email, setEmail] = useState({ newEmail: "", currentPassword: "" });
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "", confirm: "", revokeOtherSessions: true });
  const [address, setAddress] = useState({ label: "Дом", recipientName: "", recipientPhone: "", country: "Россия", region: "Пензенская область", city: "Пенза", street: "", house: "", apartment: "", postcode: "", courierComment: "", isDefault: true });
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null);

  useEffect(() => {
    if (!data) return;
    setProfile({
      firstName: data.profile.firstName || "", lastName: data.profile.lastName || "",
      displayName: data.profile.displayName || "", phone: data.profile.phone || "",
      language: data.profile.language || "ru", timezone: data.profile.timezone || "Europe/Moscow",
    });
    setAddress(current => ({ ...current, recipientName: data.profile.fullName || "", recipientPhone: data.profile.phone || "" }));
  }, [data]);

  const updateProfile = trpc.account.updateProfile.useMutation({
    onSuccess: result => {
      if (user) setUser({ ...user, ...profile, fullName: result.fullName, phone: profile.phone || null });
      utils.account.overview.invalidate(); toast.success("Личные данные сохранены");
    },
    onError: error => toast.error(error.message),
  });
  const requestEmail = trpc.account.requestEmailChange.useMutation({ onSuccess: () => { setEmail({ newEmail: "", currentPassword: "" }); toast.success("Ссылка подтверждения отправлена на новый email"); }, onError: e => toast.error(e.message) });
  const confirmEmail = trpc.account.confirmEmailChange.useMutation({
    onSuccess: result => {
      if (user) setUser({ ...user, email: result.email });
      utils.account.overview.invalidate();
      toast.success("Новый email подтверждён");
      window.history.replaceState({}, "", "/account");
    },
    onError: error => toast.error(error.message),
  });
  const changePassword = trpc.account.changePassword.useMutation({ onSuccess: () => { setPassword({ currentPassword: "", newPassword: "", confirm: "", revokeOtherSessions: true }); toast.success("Пароль изменён"); }, onError: e => toast.error(e.message) });
  const resetAddressForm = () => {
    setEditingAddressId(null);
    setAddress(current => ({ ...current, label: "Дом", street: "", house: "", apartment: "", postcode: "", courierComment: "", isDefault: data?.addresses.length === 0 }));
  };
  const saveAddress = trpc.account.saveAddress.useMutation({ onSuccess: () => { utils.account.overview.invalidate(); resetAddressForm(); toast.success("Адрес сохранён"); }, onError: e => toast.error(e.message) });
  const deleteAddress = trpc.account.deleteAddress.useMutation({ onSuccess: () => { utils.account.overview.invalidate(); toast.success("Адрес удалён"); }, onError: e => toast.error(e.message) });
  const notifications = data?.notifications;
  const [notificationDraft, setNotificationDraft] = useState<Record<string, boolean> | null>(null);
  useEffect(() => { if (notifications) setNotificationDraft({ orderEmail: notifications.orderEmail, orderPush: notifications.orderPush, orderInApp: notifications.orderInApp, marketingEmail: notifications.marketingEmail, marketingPush: notifications.marketingPush, priceDropEmail: notifications.priceDropEmail, priceDropPush: notifications.priceDropPush }); }, [notifications]);
  const saveNotifications = trpc.account.updateNotifications.useMutation({ onSuccess: () => { utils.account.overview.invalidate(); toast.success("Настройки уведомлений сохранены"); }, onError: e => toast.error(e.message) });
  const revokeSession = trpc.account.revokeSession.useMutation({ onSuccess: () => { utils.account.overview.invalidate(); toast.success("Сессия завершена"); }, onError: e => toast.error(e.message) });
  const revokeOtherSessions = trpc.account.revokeOtherSessions.useMutation({ onSuccess: () => { utils.account.overview.invalidate(); toast.success("Другие сессии завершены"); }, onError: e => toast.error(e.message) });
  const exportQuery = trpc.account.exportData.useQuery(undefined, { enabled: false });
  const deactivate = trpc.account.deactivate.useMutation({ onSuccess: () => { logout(); window.location.assign("/"); }, onError: e => toast.error(e.message) });
  const requestDeletion = trpc.account.requestDeletion.useMutation({ onSuccess: () => { logout(); window.location.assign("/"); }, onError: e => toast.error(e.message) });
  const [deactivatePassword, setDeactivatePassword] = useState("");
  const [deletion, setDeletion] = useState({ currentPassword: "", confirmation: "" });

  const initials = useMemo(() => {
    const value = data?.profile.displayName || data?.profile.fullName || data?.profile.email || "Т";
    return value.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  }, [data]);

  const profileDirty = useMemo(() => {
    if (!data) return false;
    return profile.firstName !== (data.profile.firstName || "")
      || profile.lastName !== (data.profile.lastName || "")
      || profile.displayName !== (data.profile.displayName || "")
      || profile.phone !== (data.profile.phone || "")
      || profile.language !== (data.profile.language || "ru")
      || profile.timezone !== (data.profile.timezone || "Europe/Moscow");
  }, [data, profile]);

  const editAddress = (item: NonNullable<typeof data>["addresses"][number]) => {
    setEditingAddressId(item.id);
    setAddress({
      label: item.label,
      recipientName: item.recipientName,
      recipientPhone: item.recipientPhone,
      country: item.country,
      region: item.region || "",
      city: item.city,
      street: item.street,
      house: item.house,
      apartment: item.apartment || "",
      postcode: item.postcode || "",
      courierComment: item.courierComment || "",
      isDefault: item.isDefault,
    });
  };

  useEffect(() => {
    if (emailConfirmationHandled) return;
    const confirmationToken = new URLSearchParams(window.location.search).get("confirmEmail");
    if (!confirmationToken) return;
    setEmailConfirmationHandled(true);
    confirmEmail.mutate({ token: confirmationToken });
  }, [confirmEmail, emailConfirmationHandled]);

  const uploadAvatar = async (file?: File) => {
    if (!file || !token) return;
    setAvatarPending(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/account/avatar", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
      const result = await response.json() as { avatarUrl?: string; error?: string };
      if (!response.ok || !result.avatarUrl) throw new Error(result.error || "Не удалось загрузить изображение");
      if (user) setUser({ ...user, avatarUrl: result.avatarUrl });
      await utils.account.overview.invalidate();
      toast.success("Аватар обновлён");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить изображение");
    } finally {
      setAvatarPending(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const deleteAvatar = async () => {
    if (!token) return;
    setAvatarPending(true);
    try {
      const response = await fetch("/api/account/avatar", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Не удалось удалить изображение");
      if (user) setUser({ ...user, avatarUrl: null });
      await utils.account.overview.invalidate();
      toast.success("Аватар удалён");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось удалить изображение");
    } finally {
      setAvatarPending(false);
    }
  };

  const downloadData = async () => {
    const result = await exportQuery.refetch();
    if (!result.data) return toast.error("Не удалось подготовить архив данных");
    const url = URL.createObjectURL(new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `techaks-account-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url);
  };

  if (isLoading || !data) return <div className="flex min-h-48 items-center justify-center"><Loader2 className="animate-spin text-[#05C3D4]" /></div>;

  return (
    <section className="container-main pb-4">
      <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        <nav className="flex gap-2 overflow-x-auto lg:flex-col" aria-label="Настройки кабинета">
          {sections.map(item => {
            const Icon = item.icon;
            return <button key={item.id} type="button" onClick={() => setSection(item.id)} className={`flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-4 text-left text-sm font-bold transition-colors ${section === item.id ? "bg-[#05C3D4]/15 text-[#068b98]" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}><Icon size={17} />{item.label}</button>;
          })}
        </nav>

        <div className="min-w-0 rounded-[1.75rem] bg-muted/25 p-5 md:p-8">
          {section === "profile" && <div className="space-y-8">
            <header><h2 className="text-xl font-black">Личные данные</h2><p className="mt-2 text-sm text-muted-foreground">Контакты для заказов и обращений. Email меняется отдельно после подтверждения.</p></header>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#05C3D4]/15 text-xl font-black text-[#068b98]">{data.profile.avatarUrl ? <img src={data.profile.avatarUrl} alt="Аватар пользователя" className="h-full w-full object-cover" /> : initials}</div>
              <div className="min-w-48 flex-1"><p className="font-bold">{data.profile.fullName || "Покупатель ТЕХАКС"}</p><p className="text-sm text-muted-foreground">Покупок: {data.stats.orderCount} · В избранном: {data.stats.favoriteCount}</p></div>
              <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={event => uploadAvatar(event.target.files?.[0])} />
              <div className="flex gap-2"><Button type="button" variant="outline" className="rounded-full" disabled={avatarPending} onClick={() => avatarInputRef.current?.click()}>{avatarPending ? <Loader2 size={16} className="mr-2 animate-spin" /> : <ImagePlus size={16} className="mr-2" />}Выбрать фото</Button>{data.profile.avatarUrl && <Button type="button" variant="ghost" size="icon" className="rounded-full text-red-500" disabled={avatarPending} onClick={deleteAvatar} title="Удалить аватар"><Trash2 size={17} /></Button>}</div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {([['firstName','Имя'],['lastName','Фамилия'],['displayName','Отображаемое имя'],['phone','Телефон']] as const).map(([key,label]) => <label key={key}><span className={labelClass}>{label}</span><input className={inputClass} value={profile[key]} onChange={e => setProfile(v => ({...v,[key]:e.target.value}))} /></label>)}
              <label><span className={labelClass}>Язык</span><select className={inputClass} value={profile.language} onChange={e => setProfile(v => ({...v,language:e.target.value}))}><option value="ru">Русский</option><option value="en">English</option></select></label>
              <label><span className={labelClass}>Часовой пояс</span><select className={inputClass} value={profile.timezone} onChange={e => setProfile(v => ({...v,timezone:e.target.value}))}><option value="Europe/Moscow">Москва</option><option value="Europe/Paris">Париж</option></select></label>
            </div>
            <Button onClick={() => updateProfile.mutate({ ...profile, phone: profile.phone || null, language: profile.language as "ru"|"en" })} disabled={updateProfile.isPending || !profileDirty} className="rounded-full bg-[#05C3D4] px-7 text-black"><Save size={16} className="mr-2" />{profileDirty ? "Сохранить" : "Изменений нет"}</Button>
            <div className="border-t border-border/60 pt-7"><h3 className="font-black">Смена email</h3><p className="mt-1 text-sm text-muted-foreground">Сейчас: {data.profile.email}. Старый адрес останется активным до подтверждения нового.</p><div className="mt-4 grid gap-3 md:grid-cols-2"><input type="email" className={inputClass} placeholder="Новый email" value={email.newEmail} onChange={e=>setEmail(v=>({...v,newEmail:e.target.value}))}/><input type="password" className={inputClass} placeholder="Текущий пароль" value={email.currentPassword} onChange={e=>setEmail(v=>({...v,currentPassword:e.target.value}))}/></div><Button variant="outline" className="mt-3 rounded-full" onClick={()=>requestEmail.mutate(email)}>Отправить подтверждение</Button></div>
          </div>}

          {section === "addresses" && <div className="space-y-7"><header><h2 className="text-xl font-black">Адреса доставки</h2><p className="mt-2 text-sm text-muted-foreground">Сохранённые адреса ускоряют оформление. Адрес в уже созданном заказе не изменится.</p></header>
            <div className="grid gap-3 md:grid-cols-2">{data.addresses.map(item => <article key={item.id} className="rounded-2xl bg-background p-5"><div className="flex justify-between gap-3"><div><p className="font-black">{item.label}{item.isDefault ? " · основной" : ""}</p><p className="mt-2 text-sm text-muted-foreground">{item.city}, {item.street}, {item.house}{item.apartment ? `, кв. ${item.apartment}` : ""}</p><p className="mt-1 text-sm text-muted-foreground">{item.recipientName} · {item.recipientPhone}</p></div><div className="flex shrink-0 flex-col items-end gap-2"><button className="text-xs font-bold text-[#068b98]" onClick={()=>editAddress(item)}>Изменить</button><button className="text-xs font-bold text-red-500" onClick={()=>deleteAddress.mutate({id:item.id})}>Удалить</button></div></div></article>)}</div>
            <div className="border-t border-border/60 pt-6"><div className="mb-4 flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-black"><Plus size={17}/>{editingAddressId ? "Редактирование адреса" : "Новый адрес"}</h3>{editingAddressId && <button type="button" className="text-xs font-bold text-muted-foreground" onClick={resetAddressForm}>Отменить</button>}</div><div className="grid gap-3 md:grid-cols-2">{([['label','Название'],['recipientName','Получатель'],['recipientPhone','Телефон'],['city','Город'],['street','Улица'],['house','Дом'],['apartment','Квартира'],['postcode','Индекс']] as const).map(([key,label])=><label key={key}><span className={labelClass}>{label}</span><input className={inputClass} value={address[key]} onChange={e=>setAddress(v=>({...v,[key]:e.target.value}))}/></label>)}</div><label className="mt-3 block"><span className={labelClass}>Комментарий курьеру</span><textarea className="min-h-24 w-full rounded-xl border border-border bg-background p-4 text-sm text-foreground outline-none focus:border-[#05C3D4]" value={address.courierComment} onChange={e=>setAddress(v=>({...v,courierComment:e.target.value}))}/></label><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={address.isDefault} onChange={e=>setAddress(v=>({...v,isDefault:e.target.checked}))}/>Сделать основным</label><Button disabled={saveAddress.isPending} className="mt-4 rounded-full bg-[#05C3D4] text-black" onClick={()=>saveAddress.mutate({ ...address, id: editingAddressId || undefined })}>{editingAddressId ? "Сохранить изменения" : "Сохранить адрес"}</Button></div>
          </div>}

          {section === "security" && <div className="space-y-7"><header><h2 className="text-xl font-black">Безопасность</h2><p className="mt-2 text-sm text-muted-foreground">После смены пароля можно завершить остальные авторизованные сессии.</p></header><div className="grid gap-3 md:grid-cols-2"><input type="password" className={inputClass} placeholder="Текущий пароль" value={password.currentPassword} onChange={e=>setPassword(v=>({...v,currentPassword:e.target.value}))}/><input type="password" className={inputClass} placeholder="Новый пароль, от 8 символов" value={password.newPassword} onChange={e=>setPassword(v=>({...v,newPassword:e.target.value}))}/><input type="password" className={inputClass} placeholder="Повторите новый пароль" value={password.confirm} onChange={e=>setPassword(v=>({...v,confirm:e.target.value}))}/></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={password.revokeOtherSessions} onChange={e=>setPassword(v=>({...v,revokeOtherSessions:e.target.checked}))}/>Завершить другие сессии</label><Button disabled={changePassword.isPending} className="rounded-full bg-[#05C3D4] text-black" onClick={()=>{if(password.newPassword!==password.confirm)return toast.error("Новые пароли не совпадают");changePassword.mutate({currentPassword:password.currentPassword,newPassword:password.newPassword,revokeOtherSessions:password.revokeOtherSessions})}}><KeyRound size={16} className="mr-2"/>Изменить пароль</Button><div className="border-t border-border/60 pt-6"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-black">Активные сессии</h3>{data.sessions.some(item => !item.isCurrent && !item.revokedAt) && <Button type="button" variant="outline" className="rounded-full" disabled={revokeOtherSessions.isPending} onClick={() => revokeOtherSessions.mutate()}><LogOut size={16} className="mr-2" />Завершить все другие</Button>}</div>{data.sessions.length ? <div className="mt-3 space-y-2">{data.sessions.map(item=><div key={item.id} className="flex items-center justify-between gap-4 rounded-xl bg-background p-4 text-sm"><div><p className="font-bold">{item.deviceLabel || "Браузер"}{item.isCurrent ? " · это устройство" : ""}{item.revokedAt ? " · завершена" : ""}</p><p className="mt-1 text-muted-foreground">Последняя активность: {new Date(item.lastSeenAt).toLocaleString("ru-RU")}</p></div>{!item.isCurrent && !item.revokedAt && <Button type="button" variant="ghost" className="shrink-0 rounded-full text-red-500" disabled={revokeSession.isPending} onClick={() => revokeSession.mutate({ id: item.id })}><LogOut size={16} className="mr-2" />Завершить</Button>}</div>)}</div>:<p className="mt-2 text-sm text-muted-foreground">Новые сессии появятся после следующей авторизации.</p>}</div></div>}

          {section === "notifications" && notificationDraft && <div className="space-y-6"><header><h2 className="text-xl font-black">Уведомления</h2><p className="mt-2 text-sm text-muted-foreground">Сервисные сообщения о заказах и безопасности нельзя полностью отключить.</p></header>{([['orderEmail','Заказы по email'],['orderPush','Push-уведомления о заказах'],['orderInApp','Заказы в кабинете'],['marketingEmail','Новости и предложения по email'],['marketingPush','Push с новостями и предложениями'],['priceDropEmail','Снижение цены по email'],['priceDropPush','Push о снижении цены']] as const).map(([key,label])=><label key={key} className="flex min-h-12 items-center justify-between gap-4 border-b border-border/50 py-3 text-sm font-semibold"><span>{label}</span><input type="checkbox" checked={notificationDraft[key]} onChange={e=>setNotificationDraft(v=>v?({...v,[key]:e.target.checked}):v)}/></label>)}<Button className="rounded-full bg-[#05C3D4] text-black" onClick={()=>saveNotifications.mutate(notificationDraft as any)}>Сохранить настройки</Button></div>}

          {section === "privacy" && <div className="space-y-8"><header><h2 className="text-xl font-black">Данные и приватность</h2><p className="mt-2 text-sm text-muted-foreground">Можно получить машиночитаемую копию данных или отключить кабинет. Заказы и платёжные документы сохраняются по требованиям закона.</p></header><div className="rounded-2xl bg-background p-5"><h3 className="font-black">Выгрузка данных</h3><p className="mt-2 text-sm text-muted-foreground">Профиль, адреса, заказы, избранное и журнал безопасности в JSON.</p><Button variant="outline" className="mt-4 rounded-full" onClick={downloadData}><Download size={16} className="mr-2"/>Скачать данные</Button></div><div className="rounded-2xl bg-background p-5"><h3 className="font-black">Деактивация кабинета</h3><p className="mt-2 text-sm text-muted-foreground">Вход будет отключён. Обратиться за восстановлением можно через поддержку.</p><input type="password" className={`${inputClass} mt-4`} placeholder="Текущий пароль" value={deactivatePassword} onChange={e=>setDeactivatePassword(e.target.value)}/><Button variant="outline" className="mt-3 rounded-full" disabled={deactivate.isPending || !deactivatePassword} onClick={()=>deactivate.mutate({currentPassword:deactivatePassword})}>Деактивировать</Button></div><div className="rounded-2xl bg-red-50 p-5 text-red-950 dark:bg-red-950/30 dark:text-red-100"><h3 className="font-black">Удаление аккаунта</h3><p className="mt-2 text-sm opacity-75">Профиль будет отключён и передан на удаление. Данные заказов и оплат останутся только в объёме, требуемом законом.</p><div className="mt-4 grid gap-3 md:grid-cols-2"><input type="password" className={inputClass} placeholder="Текущий пароль" value={deletion.currentPassword} onChange={e=>setDeletion(v=>({...v,currentPassword:e.target.value}))}/><input className={inputClass} placeholder="Введите УДАЛИТЬ" value={deletion.confirmation} onChange={e=>setDeletion(v=>({...v,confirmation:e.target.value}))}/></div><Button variant="destructive" className="mt-3 rounded-full" disabled={requestDeletion.isPending || deletion.confirmation !== "УДАЛИТЬ" || !deletion.currentPassword} onClick={()=>requestDeletion.mutate({currentPassword:deletion.currentPassword,confirmation:"УДАЛИТЬ"})}>Запросить удаление</Button></div></div>}
        </div>
      </div>
    </section>
  );
}
