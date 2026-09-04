import Link from 'next/link';

export function Wordmark() {
  return (
    <Link
      className="wordmark block text-[11px] font-bold uppercase leading-tight tracking-wider text-khmDark md:text-[12px]"
      href="/"
    >
      <div>Tranche</div>
      <div>Trade</div>
    </Link>
  );
}
