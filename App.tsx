
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import type { User } from 'firebase/auth';
import {
  subscribeAuthSession,
  signOutCurrentUser,
} from './services/adapters/authAdapter';
import type { AdapterError, AuthSession } from './services/adapters/types';
import { Card } from './components/ui/Card';
import LandingPage from './components/LandingPage';
import Layout from './components/Layout';
import { NotFound } from './components/NotFound';
import FeaturePage from './components/FeaturePage';
import StaticPage from './components/StaticPage';
import ScrollToTop from './components/ScrollToTop';
import { Helmet } from 'react-helmet-async';
import { AuthModal } from './components/ui/AuthModal';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { TermsOfService } from './components/TermsOfService';
import { StoreDashboard } from './components/StoreDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { WhatsAppSimulation } from './components/WhatsAppSimulation';
import About from './components/About';
import Features from './components/Features';
import Pricing from './components/Pricing';
import FAQ from './components/FAQ';
import Blog from './components/Blog';
import BlogPost from './components/BlogPost';
import CityPage from './components/CityPage';
import SeoDashboard from './components/SeoDashboard';
import Contact from './components/Contact';
import Services from './components/Services';
import HowItWorks from './components/HowItWorks';
import CaseStudies from './components/CaseStudies';
import FreeTools from './components/FreeTools';
import Templates from './components/Templates';
import { WhatsAppShopManagement } from './components/WhatsAppShopManagement';
import { GoogleReviewsShop } from './components/GoogleReviewsShop';
import { UdhaarManagementApp } from './components/UdhaarManagementApp';
import { ComparisonPage } from './components/ComparisonPage';
import { ProgrammaticSeoPage } from './components/ProgrammaticSeoPage';
import { RetailAiWiki } from './components/RetailAiWiki';
import { Coverage } from './components/Coverage';
import { GlobalCityPage } from './components/GlobalCityPage';
import { StateHubPage } from './components/StateHubPage';
import { OfficialDomainWarning } from './components/OfficialDomainWarning';
import AndroidBuildApp from './components/AndroidBuildApp';
import { KeywordsDirectory } from './components/KeywordsDirectory';
import { DukaanMitraEngineeringBible } from './components/DukaanMitraEngineeringBible';
import { HtmlSitemap } from './components/HtmlSitemap';
import { DownloadsHub } from './components/DownloadsHub';

function CityRedirect() {
  const { city } = useParams<{ city: string }>();
  const validCities = [
    "lucknow", "kanpur", "delhi", "mumbai", "bangalore", "pune", "ahmedabad", "hyderabad", "chennai", "kolkata", "jaipur", "surat",
    "agra", "aligarh", "allahabad", "amritsar", "aurangabad", "bareilly", "bhavnagar", "bhiwandi", "bhopal", "bhubaneswar",
    "bikaner", "chandigarh", "coimbatore", "cuttack", "dehradun", "dhanbad", "bhilai", "durgapur", "erode", "faridabad",
    "firozabad", "ghaziabad", "gorakhpur", "gulbarga", "guntur", "gwalior", "guwahati", "hubli", "indore", "jabalpur",
    "jalandhar", "jalgaon", "jamnagar", "jamshedpur", "jhansi", "jodhpur", "kakinada", "kochi", "kolhapur", "kollam",
    "kota", "kozhikode", "kurnool", "ludhiana", "madurai", "malegaon", "mangalore", "meerut", "moradabad", "mysore",
    "nagpur", "nanded", "nashik", "nellore", "noida", "patna", "pondicherry", "raipur", "rajkot", "rajahmundry", "ranchi",
    "rourkela", "salem", "sangli", "siliguri", "solapur", "srinagar", "thiruvananthapuram", "thrissur", "tiruchirappalli",
    "tirunelveli", "tiruppur", "ujjain", "vadodara", "varanasi", "vasai-virar", "vijayawada", "visakhapatnam", "warangal",
    "gurgaon", "ajmer", "akola", "ulhasnagar", "saharanpur", "rohtak", "mathura", "gaya"
  ];
  if (city && validCities.includes(city.toLowerCase())) {
    return <Navigate to={`/solutions/retail-ai-${city.toLowerCase()}`} replace />;
  }
  return <NotFound />;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authError, setAuthError] = useState<AdapterError | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const location = useLocation();

  // Dynamic initialization of Google Analytics (GA4)
  useEffect(() => {
    const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    if (measurementId && typeof window !== 'undefined') {
      // Check if gtag script is already added to prevent duplicate additions
      if (!document.querySelector(`script[src*="gtag/js?id=${measurementId}"]`)) {
        const script1 = document.createElement('script');
        script1.async = true;
        script1.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
        document.head.appendChild(script1);

        const script2 = document.createElement('script');
        script2.innerHTML = `
          window.dataLayer = window.dataLayer || [];
          function gtag(){window.dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${measurementId}', { send_page_view: false });
        `;
        document.head.appendChild(script2);
      }
    }
  }, []);

  // Track page views on route changes
  useEffect(() => {
    const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    if (measurementId && typeof window !== 'undefined') {
      const gtag = window.gtag || function(...args: any[]) { 
        (window.dataLayer = window.dataLayer || []).push(args); 
      };
      gtag('config', measurementId, {
        page_path: location.pathname + location.search,
        page_location: window.location.href,
        page_title: document.title,
      });
    }
  }, [location]);

  useEffect(() => {
    const unsubscribe = subscribeAuthSession((state) => {
      setUser(state.firebaseUser);
      setSession(state.session);
      setAuthError(state.error);
      setLoading(state.loading);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = () => {
    setIsAuthModalOpen(true);
  };

  const ProtectedRoute = ({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) => {
    if (loading) return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <div className="relative group">
          <div className="w-20 h-20 bg-indigo-600 rounded-[1.5rem] flex items-center justify-center shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] animate-bounce">
            <span className="text-white text-4xl font-black italic">D</span>
          </div>
          <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 whitespace-nowrap">
             <p className="text-slate-900 font-black uppercase tracking-[0.3em] text-[10px] italic animate-pulse">Initialising Munim AI v2.0...</p>
          </div>
        </div>
      </div>
    );
    if (authError && !session) {
      return (
        <div className="min-h-[70vh] flex items-center justify-center p-6">
          <Card className="max-w-lg w-full p-8 space-y-4 border-2 border-rose-200 bg-rose-50/40">
            <h2 className="text-xl font-black text-slate-900">Account Verification Required</h2>
            <p className="text-sm text-slate-600 font-medium">{authError.message}</p>
            <div className="flex gap-3 pt-2">
              {user && (
                <button
                  onClick={() => signOutCurrentUser()}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold uppercase tracking-wider"
                >
                  Sign Out
                </button>
              )}
              <button
                onClick={handleLogin}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold uppercase tracking-wider"
              >
                Sign In Again
              </button>
            </div>
          </Card>
        </div>
      );
    }
    if (!user || !session) {
      return <Navigate to="/" replace />;
    }
    if (adminOnly && !session.canAccessAdmin) {
      return <Navigate to="/dashboard" replace />;
    }
    return <>{children}</>;
  };

  return (
    <>
      <Helmet>
        <link rel="canonical" href={`https://dukaanmitra.in${location.pathname}`} />
        <meta property="og:url" content={`https://dukaanmitra.in${location.pathname}`} />
        <meta property="og:image" content="https://dukaanmitra.in/logo.svg" />
        <meta name="twitter:image" content="https://dukaanmitra.in/logo.svg" />
      </Helmet>
      <Layout isAdmin={Boolean(session?.canAccessAdmin)} user={user} onLogin={handleLogin}>
      <ScrollToTop />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/about" element={<About />} />
          <Route path="/features" element={<Features />} />
          <Route path="/whatsapp-ai" element={<FeaturePage />} />
          <Route path="/inventory" element={<FeaturePage />} />
          <Route path="/billing" element={<FeaturePage />} />
          <Route path="/udhaar" element={<FeaturePage />} />
          <Route path="/analytics" element={<FeaturePage />} />
          <Route path="/crm" element={<FeaturePage />} />
          <Route path="/retail-ai" element={<FeaturePage />} />

          <Route path="/pricing" element={<Pricing />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/docs" element={<StaticPage />} />
          <Route path="/changelog" element={<StaticPage />} />
          <Route path="/roadmap" element={<StaticPage />} />
          <Route path="/founder" element={<StaticPage />} />
          <Route path="/security" element={<StaticPage />} />
          <Route path="/support" element={<StaticPage />} />
          <Route path="/bible" element={
            <ProtectedRoute adminOnly>
              <DukaanMitraEngineeringBible user={user} role={session?.legacyRole} onLogin={handleLogin} />
            </ProtectedRoute>
          } />
          <Route path="/engineering-bible" element={
            <ProtectedRoute adminOnly>
              <DukaanMitraEngineeringBible user={user} role={session?.legacyRole} onLogin={handleLogin} />
            </ProtectedRoute>
          } />

          <Route path="/services" element={<Services />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/case-studies" element={<CaseStudies />} />
          <Route path="/free-tools" element={<FreeTools />} />
          <Route path="/downloads" element={<DownloadsHub />} />
          <Route path="/sitemap" element={<HtmlSitemap />} />
          <Route path="/android-app" element={<AndroidBuildApp />} />
          <Route path="/official-domain" element={<OfficialDomainWarning />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/knowledge" element={<RetailAiWiki />} />
          <Route path="/coverage" element={<Coverage />} />
          <Route path="/seo-dashboard" element={
            <ProtectedRoute adminOnly>
              <SeoDashboard />
            </ProtectedRoute>
          } />
          <Route path="/privacy" element={<PrivacyPolicy onBack={() => {}} />} />
          <Route path="/terms" element={<TermsOfService onBack={() => {}} />} />
          <Route path="/whatsapp-shop-management" element={<WhatsAppShopManagement />} />
          <Route path="/get-more-google-reviews-for-shop" element={<GoogleReviewsShop />} />
          <Route path="/udhaar-management-app" element={<UdhaarManagementApp />} />
          <Route path="/compare/:competitor" element={<ComparisonPage />} />
          <Route path="/p/:slug" element={<ProgrammaticSeoPage />} />
          <Route path="/keywords" element={<KeywordsDirectory />} />
          <Route path="/solutions/:country/:state" element={<StateHubPage />} />
          <Route path="/solutions/:country/:state/:city" element={<GlobalCityPage />} />
          <Route path="/solutions/retail-ai-:city" element={<CityPage />} />
          <Route path="/:city" element={<CityRedirect />} />

          {/* Merchant Routes */}
          <Route path="/demo" element={<StoreDashboard storeId="demo-mode" />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              {session?.shopId ? (
                <StoreDashboard storeId={session.shopId} session={session} />
              ) : (
                <div className="min-h-[70vh] flex items-center justify-center p-6">
                  <Card className="max-w-lg w-full p-8 space-y-4">
                    <h2 className="text-xl font-black text-slate-900">No Shop Linked Yet</h2>
                    <p className="text-sm text-slate-600">
                      Your verified account ({session?.email || user?.email}) does not have an assigned shop in Firebase project <strong>mvp1-aafa3</strong> yet. Automatic fake shop creation is disabled; complete verified shop onboarding or contact support to link your shop.
                    </p>
                  </Card>
                </div>
              )}
            </ProtectedRoute>
          } />
          <Route path="/whatsapp" element={
            <ProtectedRoute>
              {session?.shopId ? (
                <div className="p-10 flex flex-col items-center justify-center min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.05),transparent)]">
                  <div className="text-center mb-12 space-y-6 max-w-2xl">
                    <div className="inline-flex items-center px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-[0.3em] italic border-2 border-indigo-100 shadow-sm">
                      Simulation Protocol Active
                    </div>
                    <h2 className="text-5xl font-black text-slate-900 tracking-tighter italic uppercase leading-none">WhatsApp Munim AI</h2>
                    <p className="text-slate-500 font-bold italic opacity-70 underline decoration-indigo-200 decoration-offset-4">Try logging a sale (e.g. "Sent 2L milk to Ramesh for 120") or check your ledger in the dashboard after.</p>
                  </div>
                  <Card className="w-full max-w-2xl h-[700px] p-0 overflow-hidden shadow-[32px_32px_0px_0px_rgba(15,23,42,0.05)] border-4 border-slate-900 relative">
                     <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none " />
                     <div className="relative z-10 h-full">
                        <WhatsAppSimulation storeId={session.shopId} />
                     </div>
                  </Card>
                  <div className="mt-12 flex gap-4">
                     <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        End-to-End Encrypted
                     </div>
                     <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                        Agent Swarm Routed
                     </div>
                  </div>
                </div>
              ) : (
                <div className="min-h-[70vh] flex items-center justify-center p-6">
                  <Card className="max-w-lg w-full p-8 space-y-3">
                    <h2 className="text-xl font-black text-slate-900">Shop Link Required</h2>
                    <p className="text-sm text-slate-600">
                      Link a verified shop in mvp1-aafa3 before launching WhatsApp Munim operations.
                    </p>
                  </Card>
                </div>
              )}
            </ProtectedRoute>
          } />

          {/* Admin Routes */}
          <Route path="/admin" element={
            <ProtectedRoute adminOnly>
              <AdminDashboard session={session} />
            </ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  );
}
