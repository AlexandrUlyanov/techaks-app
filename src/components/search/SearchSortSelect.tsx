import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SearchSortValue =
  | "relevance"
  | "price_asc"
  | "price_desc"
  | "newest"
  | "popular";

const OPTIONS: Array<{ value: SearchSortValue; label: string }> = [
  { value: "relevance", label: "По релевантности" },
  { value: "price_asc", label: "Сначала дешевле" },
  { value: "price_desc", label: "Сначала дороже" },
  { value: "newest", label: "Сначала новинки" },
  { value: "popular", label: "Популярные" },
];

export default function SearchSortSelect({
  value,
  onChange,
}: {
  value: SearchSortValue;
  onChange: (value: SearchSortValue) => void;
}) {
  return (
    <Select value={value} onValueChange={next => onChange(next as SearchSortValue)}>
      <SelectTrigger className="min-w-[220px] rounded-xl border-border bg-card">
        <SelectValue placeholder="Сортировка" />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map(option => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
