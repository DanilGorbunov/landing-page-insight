import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeToggle } from "@/components/theme-toggle";
import Index from "./pages/Index.tsx";

const Pricing = lazy(() => import("./pages/Pricing.tsx"));
const CheckoutDemo = lazy(() => import("./pages/CheckoutDemo.tsx"));
const FullInsightsReport = lazy(() => import("./pages/FullInsightsReport.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

const queryClient = new QueryClient();

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse text-muted-foreground text-sm">Loading…</div>
    </div>
  );
}

const App = () => (
  <ErrorBoundary>
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      enableColorScheme
      storageKey="landinglens-theme"
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/checkout" element={<CheckoutDemo />} />
                <Route path="/full-insights" element={<FullInsightsReport />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          <div className="fixed bottom-4 right-4 z-[100] flex items-center gap-1 rounded-xl border border-border bg-background/90 p-1 shadow-lg backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
            <ThemeToggle />
          </div>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
