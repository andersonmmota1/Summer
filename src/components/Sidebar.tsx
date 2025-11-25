"use client";

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LogOut } from 'lucide-react';

interface NavItem {
  name: string;
  path: string;
}

interface SidebarProps {
  navItems: NavItem[];
  currentPath: string;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ navItems, currentPath, onLogout }) => {
  return (
    <aside className="flex flex-col w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border shadow-md h-screen sticky top-0">
      <div className="p-4 border-b border-sidebar-border">
        <h2 className="text-xl font-bold text-sidebar-primary-foreground">Menu</h2>
      </div>
      <ScrollArea className="flex-grow py-4">
        <nav className="space-y-1 px-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sidebar-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                currentPath === item.path && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
              )}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      </ScrollArea>
      <div className="p-4 border-t border-sidebar-border">
        <Button onClick={onLogout} variant="destructive" className="w-full">
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;