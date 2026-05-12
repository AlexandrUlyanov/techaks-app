import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import "./index.css";
import { TRPCProvider } from "@/providers/trpc";
import { AbilityProvider } from "@/providers/AbilityProvider";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <TRPCProvider>
        <AbilityProvider>
          <App />
        </AbilityProvider>
      </TRPCProvider>
    </BrowserRouter>
  </StrictMode>
);
