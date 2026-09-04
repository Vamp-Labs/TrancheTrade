import { PrimaryNav } from '@/components/PrimaryNav';
import { StatusSticker } from '@/components/StatusSticker';
import { Wordmark } from '@/components/Wordmark';
import { WalletButton } from '@/components/wallet/WalletButton';
import { SYNTHETIC_DATA_DISCLOSURE } from '@/lib/copy';
import { creditcoinCc3, ethereumSepolia } from '@/lib/networks';

export function SiteHeader() {
  return (
    <header className="relative z-20 flex w-full items-center justify-between border-b border-khmBorder/60 px-6 py-5 md:px-12">
      <div className="flex items-center">
        <PrimaryNav />
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 text-center">
        <Wordmark />
      </div>

      <div className="relative flex flex-col items-end">
        <div className="flex items-center space-x-3 text-xs font-medium tracking-wider">
          <span
            aria-label={`Source chain ${ethereumSepolia.name}, settlement chain ${creditcoinCc3.name}`}
            className="flex items-center space-x-3"
            role="group"
          >
            <span className="text-khmGray">{ethereumSepolia.shortName}</span>
            <span className="text-khmGray">/</span>
            <span className="font-semibold text-khmDark">{creditcoinCc3.shortName}</span>
          </span>
          <span className="pl-3">
            <WalletButton />
          </span>
        </div>
        <div className="mt-2">
          <StatusSticker>{SYNTHETIC_DATA_DISCLOSURE}</StatusSticker>
        </div>
      </div>
    </header>
  );
}
