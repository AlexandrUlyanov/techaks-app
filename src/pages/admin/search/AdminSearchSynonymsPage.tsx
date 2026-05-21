import { useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

type FormState = {
  id?: number;
  term: string;
  synonyms: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  term: "",
  synonyms: "",
  isActive: true,
};

export default function AdminSearchSynonymsPage() {
  const utils = trpc.useUtils();
  const { data = [], isLoading } = trpc.search.synonyms.list.useQuery();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const createMutation = trpc.search.synonyms.create.useMutation({
    onSuccess: () => {
      utils.search.synonyms.list.invalidate();
      setForm(EMPTY_FORM);
      toast.success("Группа синонимов создана");
    },
  });
  const updateMutation = trpc.search.synonyms.update.useMutation({
    onSuccess: () => {
      utils.search.synonyms.list.invalidate();
      setForm(EMPTY_FORM);
      toast.success("Группа синонимов обновлена");
    },
  });
  const deleteMutation = trpc.search.synonyms.delete.useMutation({
    onSuccess: () => {
      utils.search.synonyms.list.invalidate();
      toast.success("Группа синонимов удалена");
    },
  });

  const parsedSynonyms = useMemo(
    () =>
      form.synonyms
        .split(",")
        .map(item => item.trim())
        .filter(Boolean),
    [form.synonyms]
  );

  const submit = () => {
    const payload = {
      term: form.term.trim(),
      synonyms: parsedSynonyms,
      isActive: form.isActive,
    };
    if (!payload.term || payload.synonyms.length === 0) {
      toast.error("Заполни основной термин и хотя бы один синоним");
      return;
    }
    if (form.id) {
      updateMutation.mutate({ id: form.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-[var(--tech-radius-card)] border border-border bg-card p-6 shadow-[var(--tech-shadow-card)] lg:grid-cols-[1fr_auto]">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              Основной термин
            </div>
            <Input
              value={form.term}
              onChange={event => setForm(current => ({ ...current, term: event.target.value }))}
              placeholder="например, айфон"
            />
          </div>
          <div className="space-y-2">
            <div className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              Синонимы через запятую
            </div>
            <Input
              value={form.synonyms}
              onChange={event =>
                setForm(current => ({ ...current, synonyms: event.target.value }))
              }
              placeholder="iphone, apple phone"
            />
          </div>
          <label className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 md:col-span-2">
            <Checkbox
              checked={form.isActive}
              onCheckedChange={value =>
                setForm(current => ({ ...current, isActive: Boolean(value) }))
              }
            />
            <span className="text-sm font-medium text-foreground">Группа активна</span>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={submit} disabled={createMutation.isPending || updateMutation.isPending}>
            {createMutation.isPending || updateMutation.isPending ? (
              <Loader2 className="animate-spin" />
            ) : form.id ? (
              <Save />
            ) : (
              <Plus />
            )}
            {form.id ? "Сохранить" : "Создать"}
          </Button>
          {form.id ? (
            <Button variant="outline" onClick={() => setForm(EMPTY_FORM)}>
              Отмена
            </Button>
          ) : null}
        </div>
      </div>

      <div className="rounded-[var(--tech-radius-card)] border border-border bg-card p-2 shadow-[var(--tech-shadow-card)]">
        {isLoading ? (
          <div className="flex min-h-[180px] items-center justify-center">
            <Loader2 className="animate-spin text-[var(--tech-color-primary)]" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Термин</TableHead>
                <TableHead>Синонимы</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-bold">{item.term}</TableCell>
                  <TableCell>
                    {Array.isArray(item.synonymsJson)
                      ? item.synonymsJson.map(value => String(value)).join(", ")
                      : ""}
                  </TableCell>
                  <TableCell>{item.isActive ? "Активна" : "Отключена"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setForm({
                            id: item.id,
                            term: item.term,
                            synonyms: Array.isArray(item.synonymsJson)
                              ? item.synonymsJson.map(value => String(value)).join(", ")
                              : "",
                            isActive: item.isActive,
                          })
                        }
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate({ id: item.id })}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
