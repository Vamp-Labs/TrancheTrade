'use client';

import { useEffect, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import type { TrancheKey } from '@/lib/beats';
import { trancheWaterfallAbi, trancheWaterfallAddress } from '@/lib/contracts';
import { formatTokenAmount } from '@/lib/format';

interface InvestorPositionProps {
  tranche: TrancheKey;
}

function readPositionValue(raw: unknown, tranche: TrancheKey): bigint | null {
  if (!Array.isArray(raw)) return null;
  const values: readonly unknown[] = raw;
  const value = tranche === 'senior' ? values[0] : values[1];
  return typeof value === 'bigint' ? value : null;
}

export function InvestorPosition({ tranche }: InvestorPositionProps) {
  const [hasMounted, setHasMounted] = useState(false);
  const { address, isConnected } = useAccount();

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const isReadable = trancheWaterfallAddress !== null && address !== undefined;

  const { data } = useReadContract({
    abi: trancheWaterfallAbi,
    address: trancheWaterfallAddress ?? undefined,
    args: address === undefined ? undefined : [address],
    functionName: 'positionOf',
    query: { enabled: isReadable }
  });

  if (!hasMounted || !isConnected) return null;

  const position = readPositionValue(data, tranche);

  return (
    <div className="flex items-baseline justify-between gap-6 py-2">
      <dt className="label-utility text-khmGray">Your position</dt>
      <dd className="text-khmDark">
        {position === null ? (
          <span className="figure-md text-khmMuted">———</span>
        ) : (
          <span className="figure-md">{formatTokenAmount(position)}</span>
        )}
      </dd>
    </div>
  );
}
