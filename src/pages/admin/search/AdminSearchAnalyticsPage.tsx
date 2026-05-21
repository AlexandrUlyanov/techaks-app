import { Loader2, RefreshCcw } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-[var(--tech-radius-card)] border border-border bg-card p-5 shadow-[var(--tech-shadow-card)]">
      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-3 text-3xl font-black text-foreground">{value}</div>
    </div>
  );
}

export default function AdminSearchAnalyticsPage() {
  const query = trpc.search.adminStats.useQuery();

  if (query.isLoading || !query.data) {
    return (
      <div className="flex min-h-[260px] items-center justify-center">
        <Loader2 className="animate-spin text-[var(--tech-color-primary)]" />
      </div>
    );
  }

  const data = query.data;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => query.refetch()}>
          <RefreshCcw />
          Обновить
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Всего запросов" value={data.totals.totalLogs} />
        <MetricCard label="Без результатов" value={data.totals.noResults} />
        <MetricCard label="С малым числом результатов" value={data.totals.lowResults} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[var(--tech-radius-card)] border border-border bg-card p-4 shadow-[var(--tech-shadow-card)]">
          <div className="mb-3 text-sm font-black text-foreground">Популярные запросы</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Запрос</TableHead>
                <TableHead>Запусков</TableHead>
                <TableHead>Среднее результатов</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.popularQueries.map(item => (
                <TableRow key={item.query}>
                  <TableCell className="font-medium">{item.query}</TableCell>
                  <TableCell>{item.count}</TableCell>
                  <TableCell>{Number(item.avgResults || 0).toFixed(1)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-[var(--tech-radius-card)] border border-border bg-card p-4 shadow-[var(--tech-shadow-card)]">
          <div className="mb-3 text-sm font-black text-foreground">Запросы без результатов</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Запрос</TableHead>
                <TableHead>Повторов</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.noResultQueries.map(item => (
                <TableRow key={item.query}>
                  <TableCell className="font-medium">{item.query}</TableCell>
                  <TableCell>{item.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[var(--tech-radius-card)] border border-border bg-card p-4 shadow-[var(--tech-shadow-card)]">
          <div className="mb-3 text-sm font-black text-foreground">Запросы без кликов</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Запрос</TableHead>
                <TableHead>Повторов</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.noClickQueries as Array<{ query: string; count: number }>).map(item => (
                <TableRow key={item.query}>
                  <TableCell className="font-medium">{item.query}</TableCell>
                  <TableCell>{item.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-[var(--tech-radius-card)] border border-border bg-card p-4 shadow-[var(--tech-shadow-card)]">
          <div className="mb-3 text-sm font-black text-foreground">Товары с кликами из поиска</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Товар</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Кликов</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.topClickedProducts as Array<{ entityId: number; title: string; url: string; count: number }>).map(item => (
                <TableRow key={`${item.entityId}-${item.url}`}>
                  <TableCell className="font-medium">{item.title}</TableCell>
                  <TableCell className="max-w-[220px] truncate text-muted-foreground">
                    {item.url}
                  </TableCell>
                  <TableCell>{item.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
