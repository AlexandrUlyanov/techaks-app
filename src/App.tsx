import { Routes, Route, useLocation } from "react-router";
import { Toaster } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StickyBottomBar from "@/components/StickyBottomBar";
import HomePage from "@/pages/HomePage";
import CatalogPage from "@/pages/CatalogPage";
import ProductPage from "@/pages/ProductPage";
import StoresPage from "@/pages/StoresPage";
import ContactsPage from "@/pages/ContactsPage";
import PromotionsPage from "@/pages/PromotionsPage";
import PromotionDetailPage from "@/pages/PromotionDetailPage";

// Admin Pages
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminProducts from "@/pages/admin/AdminProducts";
import AdminStores from "@/pages/admin/AdminStores";
import AdminLeads from "@/pages/admin/AdminLeads";
import AdminBanners from "@/pages/admin/AdminBanners";

export default function App() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

  return (
    <div className="min-h-screen flex flex-col">
      {!isAdmin && <Header />}
      <main className="flex-1">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="/stores" element={<StoresPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/promotions" element={<PromotionsPage />} />
          <Route path="/promotions/:slug" element={<PromotionDetailPage />} />

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="leads" element={<AdminLeads />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="stores" element={<AdminStores />} />
            <Route path="banners" element={<AdminBanners />} />
            <Route path="settings" element={<div>Настройки системы (в разработке)</div>} />
          </Route>
        </Routes>
      </main>
      {!isAdmin && <Footer />}
      {!isAdmin && <StickyBottomBar />}
      <Toaster position="top-center" richColors />
    </div>
  );
}
