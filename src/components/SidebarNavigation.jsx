import React, { memo } from 'react';
import { GraduationCap, LayoutDashboard, MessageSquareMore } from 'lucide-react';

const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    id: 'intercom',
    label: 'Intercom',
    icon: MessageSquareMore,
  },
  {
    id: 'university',
    label: 'Threecolts University',
    icon: GraduationCap,
  },
];

export const SidebarNavigation = memo(({ activeSection, onChange }) => (
  <aside className="sidebar-nav" aria-label="Primary navigation">
    <div className="sidebar-brand">
      <span className="sidebar-brand-mark" aria-hidden="true">
        CI
      </span>
      <div className="sidebar-brand-copy">
        <strong>Analytics</strong>
        <span>Workspace</span>
      </div>
    </div>
    <div className="sidebar-nav-section-label">Main menu</div>
    <nav className="sidebar-nav-list">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;

        return (
          <button
            key={item.id}
            type="button"
            className={`sidebar-nav-item ${activeSection === item.id ? 'active' : ''}`}
            onClick={() => onChange(item.id)}
          >
            <Icon size={18} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  </aside>
));
