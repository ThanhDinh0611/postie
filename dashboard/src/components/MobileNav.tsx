import { Link, useLocation } from 'react-router-dom';

interface MobileNavProps {
  isAdmin: boolean;
}

const TABS: { to: string; label: string; icon: string; exact?: boolean }[] = [
  { to: '/', label: 'Tạo bài', icon: '✍️', exact: true },
  { to: '/analytics', label: 'Phân tích', icon: '📊' },
  { to: '/history', label: 'Lịch sử', icon: '📝' },
  { to: '/pages', label: 'Trang', icon: '📋' },
];

export default function MobileNav({ isAdmin }: MobileNavProps) {
  const location = useLocation();
  const path = location.pathname;

  if (!isAdmin) return null;

  return (
    <nav className="mobile-nav">
      {TABS.map((tab) => {
        const isActive = tab.exact ? path === tab.to : path.startsWith(tab.to);
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={`mobile-nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="mobile-nav-icon">{tab.icon}</span>
            <span className="mobile-nav-label">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
