'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavEntry {
  href: string;
  label: string;
  icon: 'tranches' | 'trail';
}

const NAV_ENTRIES: readonly NavEntry[] = [
  { href: '/', label: 'Pool', icon: 'tranches' },
  { href: '/activity', label: 'Activity', icon: 'trail' }
];

function NavIcon({ icon }: { icon: NavEntry['icon'] }) {
  if (icon === 'tranches') {
    return (
      <svg
        aria-hidden="true"
        className="h-4 w-4 stroke-[1.5] text-khmDark"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <line x1="3" x2="21" y1="7" y2="7" />
        <line x1="3" x2="15" y1="17" y2="17" />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 stroke-[1.5] text-khmDark"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <line x1="3" x2="21" y1="6" y2="6" />
      <line x1="3" x2="21" y1="12" y2="12" />
      <line x1="3" x2="13" y1="18" y2="18" />
    </svg>
  );
}

export function PrimaryNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex items-center gap-6">
      {NAV_ENTRIES.map((entry) => {
        const isCurrent =
          entry.href === '/' ? pathname === '/' : pathname.startsWith(entry.href);
        return (
          <Link
            aria-current={isCurrent ? 'page' : undefined}
            className="flex items-center gap-2 text-sm tracking-wide transition-opacity hover:opacity-70"
            href={entry.href}
            key={entry.href}
          >
            <NavIcon icon={entry.icon} />
            <span
              className={`text-[15px] ${isCurrent ? 'font-semibold text-khmDark' : 'font-normal text-khmGray'}`}
            >
              {entry.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
