import React from 'react';
import { Inbox, Sun, CalendarDays, Layers, Search } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { localize } from '@/nls';

export const StillNavigation = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  if (!['/home', '/inbox', '/today', '/scheduled', '/completed'].includes(pathname)) return null;
  const items = [
    { path: '/inbox', label: localize('inbox', 'Inbox'), Icon: Inbox },
    { path: '/today', label: localize('today', 'Today'), Icon: Sun },
    { path: '/scheduled', label: localize('schedule', 'Upcoming'), Icon: CalendarDays },
    { path: '/home', label: localize('sidebar.projects.title', 'Projects'), Icon: Layers },
    { path: '/search', label: 'Search', Icon: Search },
  ];
  return <nav className="still-mobile-nav" aria-label="Main navigation">
    {items.map(({ path, label, Icon }) => <button key={path} type="button"
      aria-current={pathname === path ? 'page' : undefined} onClick={() => navigate(path)}>
      <Icon aria-hidden="true" /><span>{label}</span>
    </button>)}
  </nav>;
};
