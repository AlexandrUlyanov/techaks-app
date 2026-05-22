type ProductQuickSpecsProps = {
  title?: string;
  specs: Array<[string, unknown]>;
};

export default function ProductQuickSpecs({
  title = "О товаре",
  specs,
}: ProductQuickSpecsProps) {
  if (specs.length === 0) return null;

  return (
    <section className="rounded-[1.6rem] bg-[#F6F7F8] px-5 py-6 md:px-6">
      <h2 className="text-xl font-black tracking-tight text-[#1F2328] md:text-2xl">
        {title}
      </h2>
      <div className="mt-5 grid gap-3">
        {specs.map(([key, value]) => (
          <div key={key} className="text-[15px] leading-6 text-[#1F2328]">
            <span className="font-medium text-[#7A7F87]">{key}:</span>{" "}
            <span className="font-semibold">{String(value)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
