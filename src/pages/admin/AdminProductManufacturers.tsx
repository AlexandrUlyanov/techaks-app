import AdminPageHeader from "@/components/admin/AdminPageHeader";
import ManufacturerCatalogPanel from "@/components/admin/ManufacturerCatalogPanel";

export default function AdminProductManufacturers() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Каталог"
        title="Производители каталога"
        description="Отдельная рабочая страница для брендового каталога: сбор производителей, логотипы, slug, SEO и видимость на витрине."
      />
      <ManufacturerCatalogPanel />
    </div>
  );
}
