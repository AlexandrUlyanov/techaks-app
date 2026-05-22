type ProductDescriptionProps = {
  description: string;
};

export default function ProductDescription({
  description,
}: ProductDescriptionProps) {
  if (!description.trim()) return null;

  return (
    <section className="mt-16 max-w-[900px]">
      <h2 className="text-3xl font-black tracking-tight text-[#1F2328] md:text-4xl">
        Описание
      </h2>
      <div className="mt-6 text-[16px] leading-8 text-[#1F2328] md:text-[17px]">
        <p>{description}</p>
      </div>
    </section>
  );
}
