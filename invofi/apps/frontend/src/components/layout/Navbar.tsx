'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Store,
  Briefcase,
  Settings,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';
import { WalletButton } from '@/components/auth/WalletButton';
import { supabase } from '@/lib/supabase';
import { useLocalStorage } from '@/hooks/useLocalStorage';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/marketplace', label: 'Marketplace', icon: Store },
  { href: '/portfolio', label: 'Portfolio', icon: Briefcase },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);

  const [theme, setTheme] = useLocalStorage<'light' | 'dark'>(
    'theme',
    'light'
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme, mounted]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (!mounted) return null;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-lg"
        >
          <span className="text-blue-600">Invo</span>
          <span className="text-foreground">Fi</span>
        </Link>

        {/* Navigation */}
        <nav aria-label="Main navigation" className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm transition-colors',
                pathname.startsWith(link.href)
                  ? 'bg-blue-50 text-blue-700 dark:bg-gray-800 dark:text-blue-400 font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md text-muted-foreground hover:bg-accent transition-colors"
            title="Toggle theme"
            aria-label="Toggle dark mode"
          >
            {theme === 'light' ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
          </button>

          <WalletButton />

          <Link
            href="/settings"
            className={cn(
              'hidden md:flex items-center text-muted-foreground hover:text-foreground transition-colors',
              pathname.startsWith('/settings') &&
                'text-blue-700 dark:text-blue-400'
            )}
            title="Settings"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </Link>

          <button
            onClick={handleSignOut}
            className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}