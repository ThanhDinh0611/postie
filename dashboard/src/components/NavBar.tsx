import { Link, useLocation } from 'react-router-dom';
import { SignedIn, SignedOut, UserButton } from '@clerk/clerk-react';

interface NavBarProps {
  isAdmin: boolean;
}

export default function NavBar({ isAdmin }: NavBarProps) {
  const location = useLocation();
  const path = location.pathname;

  const navLinks = isAdmin ? [
    { to: '/', label: '🏠 Tạo bài viết', exact: true },
    { to: '/analytics', label: '📊 Phân tích' },
    { to: '/history', label: '📝 Lịch sử' },
    { to: '/pages', label: '📋 Trang & Chiến dịch' },
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
