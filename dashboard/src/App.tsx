import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { ClerkProvider, SignedIn, SignedOut, useAuth, useUser, SignIn, SignUp, SignOutButton, RedirectToSignIn, AuthenticateWithRedirectCallback } from '@clerk/clerk-react';
import { dark } from '@clerk/themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { syncAuthUser } from '@/api/client.ts';
import ErrorBoundary from '@/components/ErrorBoundary.tsx';
import MobileNav from '@/components/MobileNav.tsx';
import NavBar from '@/components/NavBar.tsx';
import HomePage from '@/components/HomePage.tsx';
import PagesPage from '@/components/PagesPage.tsx';
import PostHistory from '@/components/PostHistory.tsx';
import SyncDashboard from '@/components/SyncDashboard.tsx';
import { ToastProvider } from '@/hooks/useToast.tsx';

const CLERK_PUBLISHABLE_KEY = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string || '').trim();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

function AuthPage() {
  return (
    <div className="flex justify-center items-center" style={{ padding: '40px 0' }}>
      <Routes>
        <Route path="/" element={<SignIn routing="path" path="/auth" signUpUrl="/auth/sign-up" />} />
        <Route path="/sign-up" element={<SignUp routing="path" path="/auth/sign-up" signInUrl="/auth" />} />
        <Route path="/sso-callback" element={<AuthenticateWithRedirectCallback signUpForceRedirectUrl="/" signInForceRedirectUrl="/" />} />
      </Routes>
    </div>
  );
}

function AdminRequiredPage() {
  return (
    <div className="container text-center" style={{ maxWidth: 540, margin: '60px auto' }}>
      <div className="placeholder-card text-center" style={{ padding: 40, border: '1px dashed var(--danger)' }}>
        <span className="text-xl" style={{ fontSize: '3rem' }}>🔒</span>
        <h2 className="text-danger" style={{ marginTop: 16 }}>Yêu cầu quyền Admin</h2>
        <p className="text-muted" style={{ margin: '12px 0 24px', lineHeight: '1.6' }}>
          Hệ thống hiện đang chạy ở chế độ thử nghiệm giới hạn. Chỉ tài khoản có vai trò <strong>admin</strong> mới có thể sử dụng các chức năng này.
        </p>
        <div className="flex justify-center gap-12">
          <SignOutButton>
            <button className="btn btn-primary">Đăng xuất</button>
          </SignOutButton>
          <a href="/" className="btn">Quay lại Trang chủ</a>
        </div>
      </div>
    </div>
  );
}

// ─── AppInner ────────────────────────────────────────────────────────────────

function AppInner() {
  const { isSignedIn, getToken } = useAuth();
  const { isLoaded } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isRoleLoading, setIsRoleLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  // Redirect OAuth code from / to /pages
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    if (code && location.pathname === '/') {
      navigate(`/pages?${params.toString()}`, { replace: true });
    }
  }, [location, navigate]);

  useEffect(() => {
    async function checkRole() {
      if (!isLoaded) return;
      if (!isSignedIn) {
        setIsRoleLoading(false);
        return;
      }
      setIsRoleLoading(true);
      const token = await getToken();
      if (!token) {
        setIsRoleLoading(false);
        return;
      }
      try {
        const syncRes = await syncAuthUser(token);
        setIsAdmin(syncRes.role === 'admin');
      } catch (err) {
        console.error('Failed to sync auth user role:', err);
      } finally {
        setIsRoleLoading(false);
      }
    }
    checkRole();
  }, [isLoaded, isSignedIn, getToken, location.pathname]);

  if (!isLoaded || (isSignedIn && isRoleLoading)) {
    return (
      <div className="flex justify-center items-center text-muted" style={{ height: '100vh' }}>
        <p>Đang tải thông tin tài khoản...</p>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <NavBar isAdmin={isAdmin} />
      <MobileNav isAdmin={isAdmin} />
      <main className="main-content">
        <Routes>
          <Route
            path="/"
            element={
              <>
                <SignedOut>
                  <div className="hero">
                    <h1>✍️ Postie</h1>
                    <p className="hero-sub">Tạo bài viết Facebook bằng AI — Đăng lên fanpage — Nhận link ngay</p>
                    <Link to="/auth" className="btn btn-primary btn-lg">Bắt đầu ngay →</Link>
                    <div className="hero-features">
                      <span>🤖 AI viết bài</span>
                      <span>📸 Đăng ảnh</span>
                      <span>🔗 Tạo link</span>
                      <span>📅 Lên lịch</span>
                      <span>🎬 Viết Reels</span>
                    </div>
                  </div>
                </SignedOut>
                <SignedIn>
                  {isAdmin ? <ErrorBoundary><HomePage /></ErrorBoundary> : <AdminRequiredPage />}
                </SignedIn>
              </>
            }
          />
          <Route path="/auth/*" element={<AuthPage />} />
          <Route
            path="/history"
            element={
              <>
                <SignedIn>
                  {isAdmin ? (
                    <div className="container">
                      <div className="spacer-24" />
                      <h2>📝 Lịch sử đăng bài</h2>
                      <p className="text-muted">Quản lý các bài viết và link đã tạo.</p>
                      <div className="mt-24">
                        <ErrorBoundary><PostHistory /></ErrorBoundary>
                      </div>
                    </div>
                  ) : <AdminRequiredPage />}
                </SignedIn>
                <SignedOut>
                  <RedirectToSignIn />
                </SignedOut>
              </>
            }
          />
          <Route
            path="/pages"
            element={
              <>
                <SignedIn>
                  {isAdmin ? (
                    <ErrorBoundary><PagesPage /></ErrorBoundary>
                  ) : <AdminRequiredPage />}
                </SignedIn>
                <SignedOut>
                  <RedirectToSignIn />
                </SignedOut>
              </>
            }
          />
          <Route
            path="/analytics"
            element={
              <>
                <SignedIn>
                  {isAdmin ? (
                    <div className="container">
                      <div className="spacer-24" />
                      <ErrorBoundary><SyncDashboard /></ErrorBoundary>
                    </div>
                  ) : <AdminRequiredPage />}
                </SignedIn>
                <SignedOut>
                  <RedirectToSignIn />
                </SignedOut>
              </>
            }
          />
        </Routes>
      </main>
      <footer className="footer">Postie — Đăng bài ngon lành, link trao tay · Miễn phí</footer>
    </div>
  );
}

// ─── Clerk Provider ──────────────────────────────────────────────────────────

function ClerkProviderWithRouter() {
  const navigate = useNavigate();
  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      routerPush={(to: string) => navigate(to)}
      routerReplace={(to: string) => navigate(to, { replace: true })}
      appearance={{
        baseTheme: dark,
        layout: { unsafe_disableDevelopmentModeWarnings: true },
        variables: {
          colorPrimary: '#f59e0b',
          colorBackground: '#0f1117',
          colorInputBackground: '#1a1d27',
          colorInputText: '#f1f5f9',
          colorText: '#f1f5f9',
          colorTextSecondary: '#94a3b8',
          borderRadius: '12px',
        },
      }}
    >
      <AppInner />
    </ClerkProvider>
  );
}

// ─── App Root ────────────────────────────────────────────────────────────────

export default function App() {
  if (!CLERK_PUBLISHABLE_KEY) {
    return (
      <div className="text-center text-danger" style={{ padding: 40 }}>
        <h2>⚠️ Thiếu cấu hình Clerk</h2>
        <p>Thêm <code>VITE_CLERK_PUBLISHABLE_KEY</code> vào file <code>.env</code></p>
      </div>
    );
  }
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ClerkProviderWithRouter />
        </ToastProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}
