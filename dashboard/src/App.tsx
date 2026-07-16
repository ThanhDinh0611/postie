import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { ClerkProvider, SignedIn, SignedOut, UserButton, useAuth, useUser, SignIn, SignUp, SignOutButton, RedirectToSignIn, AuthenticateWithRedirectCallback } from '@clerk/clerk-react';
import { dark } from '@clerk/themes';
import { getPages, getPosts, getLinks, generatePost, publishPost, syncAuthUser, type PageData, type PostData, type LinkData, type GenerateResponse, type PublishResponse } from './api.ts';
import PostGenerator from './components/PostGenerator.tsx';
import PostPreview from './components/PostPreview.tsx';
import LinkResultCard from './components/LinkResultCard.tsx';

const CLERK_PUBLISHABLE_KEY = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string || '').trim();

// ─── Navigation ──────────────────────────────────────────────────────────────

function NavBar({ isAdmin }: { isAdmin: boolean }) {
  const location = useLocation();
  const path = location.pathname;

  const navLinks = isAdmin ? [
    { to: '/', label: '🏠 Tạo bài viết', exact: true },
    { to: '/links', label: '🔗 Link của tôi' },
    { to: '/pages', label: '📋 Trang Facebook' },
  ] : [];

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link to="/" className="nav-logo">
          <span className="logo-icon">✍️</span>
          <span className="logo-text">Postie</span>
        </Link>
        <div className="nav-links">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`nav-link ${l.exact ? path === l.to : path.startsWith(l.to) ? 'active' : ''}`}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className="nav-auth">
          <SignedIn><UserButton /></SignedIn>
          <SignedOut><Link to="/auth" className="btn btn-primary btn-sm">Đăng nhập</Link></SignedOut>
        </div>
      </div>
    </nav>
  );
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// ─── Page Components ─────────────────────────────────────────────────────────

function HomePage({ pages }: { pages: PageData[] }) {
  const { getToken } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [generationResult, setGenerationResult] = useState<GenerateResponse | null>(null);
  const [publishResult, setPublishResult] = useState<PublishResponse | null>(null);
  const [selectedPageId, setSelectedPageId] = useState('');

  // Set default active page
  useEffect(() => {
    if (pages.length > 0 && !selectedPageId) {
      const active = pages.find(p => p.is_active);
      if (active) setSelectedPageId(active.id);
      else setSelectedPageId(pages[0]!.id);
    }
  }, [pages, selectedPageId]);

  const handleGenerate = async (data: {
    topic: string;
    hookType: string;
    formula: string;
    tone: string;
    postFormat: 'Post' | 'Reel' | 'Video';
  }) => {
    setIsGenerating(true);
    setPublishResult(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Unauthorized');
      const result = await generatePost({
        topic: data.topic,
        hookType: data.hookType,
        formula: data.formula,
        tone: data.tone,
        postFormat: data.postFormat
      }, token);
      setGenerationResult(result);
    } catch (err) {
      alert(`⚠️ Lỗi tạo bài viết: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublish = async (finalContent: string) => {
    if (!selectedPageId) {
      alert('⚠️ Vui lòng chọn Fanpage để đăng bài!');
      return;
    }
    setIsPublishing(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Unauthorized');
      const result = await publishPost({
        content: finalContent,
        pageId: selectedPageId,
        hookType: generationResult?.selectedHook,
        formula: generationResult?.formulaApplied
      }, token);
      setPublishResult(result);
    } catch (err) {
      alert(`⚠️ Lỗi đăng bài: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleReset = () => {
    setGenerationResult(null);
    setPublishResult(null);
  };

  return (
    <div className="container">
      <div style={{ height: 24 }} />
      <h2>Tạo bài viết mới</h2>
      <p className="text-muted">AI sẽ viết nội dung dựa trên chủ đề, tối ưu cho Facebook.</p>

      {publishResult ? (
        <LinkResultCard
          permalink={publishResult.permalink}
          facebookPostId={publishResult.facebookPostId}
          onReset={handleReset}
        />
      ) : (
        <div className="generator-grid">
          <PostGenerator onGenerate={handleGenerate} isGenerating={isGenerating} />
          {generationResult ? (
            <PostPreview
              content={generationResult.content}
              isPublishing={isPublishing}
              onPublish={handlePublish}
              pages={pages}
              selectedPageId={selectedPageId}
              setSelectedPageId={setSelectedPageId}
            />
          ) : (
            <div className="preview-card" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '300px', color: 'var(--text-muted)' }}>
              <p>🔮 Cấu hình cài đặt bên trái và nhấn nút "Tạo bài viết" để xem bản nháp AI.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LinksPage({ links }: { links: LinkData[] }) {
  return (
    <div className="container">
      <div style={{ height: 24 }} />
      <h2>🔗 Link của tôi</h2>
      <p className="text-muted">Danh sách link bài viết đã đăng.</p>
      {links.length === 0 ? (
        <div className="placeholder-card">
          <p>Chưa có bài viết nào được đăng. Tạo bài mới và đăng lên fanpage!</p>
        </div>
      ) : (
        <div className="link-list">
          {links.map((link) => (
            <div key={link.id} className="link-item">
              <div className="link-message">{link.message.slice(0, 100)}...</div>
              <div className="link-meta">
                <span>{link.page_name}</span>
                <span className="badge">{link.status}</span>
              </div>
              <a href={link.permalink ?? '#'} target="_blank" rel="noopener noreferrer" className="btn btn-sm">
                🔗 Mở link
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PagesPage({ pages }: { pages: PageData[] }) {
  return (
    <div className="container">
      <div style={{ height: 24 }} />
      <h2>📋 Trang Facebook</h2>
      <p className="text-muted">Quản lý các trang Facebook đã kết nối.</p>
      {pages.length === 0 ? (
        <div className="placeholder-card">
          <p>Chưa kết nối trang nào. Kết nối qua OAuth để bắt đầu.</p>
        </div>
      ) : (
        <div className="page-grid">
          {pages.map((page) => (
            <div key={page.id} className={`page-card ${page.is_active ? 'active' : ''}`}>
              <div className="page-name">{page.name}</div>
              <div className="page-status">{page.is_active ? '✅ Đang hoạt động' : '⏸️ Không hoạt động'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AuthPage() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px 0' }}>
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
    <div className="container" style={{ maxWidth: 540, margin: '60px auto', textAlign: 'center' }}>
      <div className="placeholder-card" style={{ padding: 40, border: '1px dashed #ef4444' }}>
        <span style={{ fontSize: 48 }}>🔒</span>
        <h2 style={{ marginTop: 16, color: '#ef4444' }}>Yêu cầu quyền Admin</h2>
        <p className="text-muted" style={{ margin: '12px 0 24px', lineHeight: '1.6' }}>
          Hệ thống hiện đang chạy ở chế độ thử nghiệm giới hạn. Chỉ tài khoản có vai trò <strong>admin</strong> mới có thể sử dụng các chức năng này.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
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
  const [pages, setPages] = useState<PageData[]>([]);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [links, setLinks] = useState<LinkData[]>([]);
  const { isSignedIn, getToken } = useAuth();
  const { isLoaded } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isRoleLoading, setIsRoleLoading] = useState(true);
  const location = useLocation();
  console.debug('Loaded posts:', posts.length);

  const loadData = useCallback(async () => {
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
      const isUserAdmin = syncRes.role === 'admin';
      setIsAdmin(isUserAdmin);

      if (isUserAdmin) {
        const [fetchedPages, fetchedPosts, fetchedLinks] = await Promise.all([
          getPages(token), getPosts(token), getLinks(token),
        ]);
        setPages(fetchedPages);
        setPosts(fetchedPosts);
        setLinks(fetchedLinks);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setIsRoleLoading(false);
    }
  }, [isLoaded, isSignedIn, getToken]);

  useEffect(() => { loadData(); }, [loadData, location.pathname]);

  if (!isLoaded || (isSignedIn && isRoleLoading)) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#94a3b8' }}>
        <p>Đang tải thông tin tài khoản...</p>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <NavBar isAdmin={isAdmin} />
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
                  {isAdmin ? <HomePage pages={pages} /> : <AdminRequiredPage />}
                </SignedIn>
              </>
            }
          />
          <Route path="/auth/*" element={<AuthPage />} />
          <Route
            path="/links"
            element={
              <>
                <SignedIn>
                  {isAdmin ? <LinksPage links={links} /> : <AdminRequiredPage />}
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
                  {isAdmin ? <PagesPage pages={pages} /> : <AdminRequiredPage />}
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
      <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>
        <h2>⚠️ Thiếu cấu hình Clerk</h2>
        <p>Thêm <code>VITE_CLERK_PUBLISHABLE_KEY</code> vào file <code>.env</code></p>
      </div>
    );
  }
  return (
    <BrowserRouter>
      <ClerkProviderWithRouter />
    </BrowserRouter>
  );
}
