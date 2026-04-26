import React, { useState } from 'react';
import { Database, Brain, Workflow, ChevronLeft, ChevronRight } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    { to: '/datasets', label: 'Dataset',  icon: Database },
    { to: '/models',   label: 'AI Model', icon: Brain    },
    { to: '/pipelines',label: 'Pipeline', icon: Workflow },
  ];

  return (
    <aside className={`${collapsed ? 'w-14' : 'w-52'} bg-surface border-r border-border min-h-screen flex flex-col transition-all duration-300 shrink-0`}>
      {/* Header */}
      <div className="p-4 bg-[var(--green-dark)] text-white border-b border-[var(--green)] flex items-center justify-between">
        {!collapsed && <h1 className="text-base font-semibold truncate">AI Platform</h1>}
        <button
          onClick={() => setCollapsed(v => !v)}
          className="p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0 ml-auto"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="p-2 flex-1">
        <div className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `w-full text-left p-3 rounded-lg transition-all duration-200 flex items-center gap-3 ${
                    isActive
                      ? 'bg-green-pale border border-green-light text-green-dark'
                      : 'hover:bg-gray-50 text-text'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-green' : 'text-muted'}`} />
                    {!collapsed && <span className="font-medium text-sm truncate">{item.label}</span>}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </aside>
  );
};

export default Sidebar;
