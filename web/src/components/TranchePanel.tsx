import type { ReactNode } from 'react';
import { TrancheFigure } from '@/components/cascade/TrancheFigure';
import { TrancheRuleSweep } from '@/components/cascade/TrancheRuleSweep';
import { InvestorPosition } from '@/components/InvestorPosition';
import type { TrancheKey } from '@/lib/beats';
import { formatRateMultiplier, formatTokenAmount } from '@/lib/format';
import { creditcoinCc3 } from '@/lib/networks';

interface TranchePanelProps {
  tranche: TrancheKey;
  ordinal: string;
  label: string;
  sentence: string;
  outstanding: string;
  allocatedTotal: string;
  principal: bigint;
  cap: bigint;
  rateBps: bigint;
}

interface LedgerRowProps {
  label: string;
  children: ReactNode;
}

function LedgerRow({ label, children }: LedgerRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-2">
      <dt className="label-utility text-khmGray">{label}</dt>
      <dd className="text-khmDark">{children}</dd>
    </div>
  );
}

export function TranchePanel({
  tranche,
  ordinal,
  label,
  sentence,
  outstanding,
  allocatedTotal,
  principal,
  cap,
  rateBps
}: TranchePanelProps) {
  const isSenior = tranche === 'senior';
  const outstandingField = isSenior ? 'seniorOutstanding' : 'juniorOutstanding';
  const allocatedField = isSenior ? 'seniorAllocatedTotal' : 'juniorAllocatedTotal';

  return (
    <article
      className={`relative p-6 md:col-span-6 md:p-8 ${
        isSenior ? 'border-t-2 border-khmDark' : 'border-t border-khmBorder'
      }`}
    >
      <TrancheRuleSweep tranche={tranche} />

      <div className="flex items-baseline justify-between">
        <span aria-hidden="true" className="font-serif text-[2rem] leading-none text-khmGray">
          {ordinal}
        </span>
        <span className="label-utility text-khmDark">{label}</span>
      </div>

      <div className="mt-14">
        <TrancheFigure fallback={outstanding} field={outstandingField} variant="lg" />
        <p className="label-utility mt-3 text-khmGray">
          {creditcoinCc3.currencySymbol} outstanding
        </p>
      </div>

      <dl className="mt-12 border-t border-khmBorder/60 pt-4">
        <LedgerRow label="Allocated to date">
          <TrancheFigure fallback={allocatedTotal} field={allocatedField} variant="md" />
        </LedgerRow>
        <LedgerRow label="Principal deposited">
          <span className="figure-md">{formatTokenAmount(principal)}</span>
        </LedgerRow>
        <LedgerRow label="Cap">
          <span className="figure-md">{formatTokenAmount(cap)}</span>
        </LedgerRow>
        <LedgerRow label="Entitlement rule">
          <span className="figure-md">{formatRateMultiplier(rateBps)}×</span>
        </LedgerRow>
        <InvestorPosition tranche={tranche} />
      </dl>

      <p className="mt-8 max-w-[34ch] text-[15px] leading-snug text-khmGray">{sentence}</p>
    </article>
  );
}
