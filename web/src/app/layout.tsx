import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { ProvenanceNotice } from '@/components/ProvenanceNotice';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { WalletProviders } from '@/components/wallet/WalletProviders';
import { isTrancheWaterfallDeployed } from '@/lib/contracts';
import { resolveManifest } from '@/lib/manifest';

export const metadata: Metadata = {
  title: 'TrancheTrade',
  description:
    'An attestation-gated senior/junior waterfall for trade-finance repayment events, settled on Creditcoin CC3.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const resolved = resolveManifest();

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col overflow-x-hidden bg-khmBg font-sans text-khmDark">
        <WalletProviders>
          <SiteHeader />
          <ProvenanceNotice
            isContractDeployed={isTrancheWaterfallDeployed}
            manifestOrigin={resolved.origin}
            manifestSourcePath={resolved.sourcePath}
          />
          <main className="z-10 flex flex-grow flex-col pt-8 md:pt-14">{children}</main>
          <SiteFooter />
        </WalletProviders>
      </body>
    </html>
  );
}
