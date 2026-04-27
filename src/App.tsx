import { Routes, Route } from "react-router";
import { Toaster } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StickyBottomBar from "@/components/StickyBottomBar";
import HomePage from "@/pages/HomePage";
import CatalogPage from "@/pages/CatalogPage";
import ProductPage from "@/pages/ProductPage";
import StoresPage from "@/pages/StoresPage";
import ContactsPage from "@/pages/ContactsPage";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="/stores" element={<StoresPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
        </Routes>
      </main>
      <Footer />
      <StickyBottomBar />
      <Toaster position="top-center" richColors />
    </div>
  );
}
