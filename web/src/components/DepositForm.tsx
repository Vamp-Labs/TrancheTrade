'use client';

import { useEffect, useId, useState } from 'react';
import { useAccount, useChainId, useSwitchChain, useWriteContract } from 'wagmi';
import type { TrancheKey } from '@/lib/beats';
import { creditcoinCc3Chain } from '@/lib/chains';
import { trancheWaterfallAbi, type EvmAddress } from '@/lib/contracts';
import {
  DEPOSITS_DISABLED_NOT_DEPLOYED,
  DEPOSITS_DISABLED_NO_WALLET,
  DEPOSITS_DISABLED_WRONG_CHAIN,
  FIXED_RULE_SENTENCE
} from '@/lib/copy';
import { applyRateBps, formatRateMultiplier, formatTokenAmount, toWei } from '@/lib/format';
import { creditcoinCc3 } from '@/lib/networks';

const TRANCHE_ORDINAL: Record<TrancheKey, number> = { senior: 0, junior: 1 };

interface DepositFormProps {
  waterfallAddress: EvmAddress | null;
  seniorRateBps: string;
  juniorRateBps: string;
}

export function DepositForm({
  waterfallAddress,
  seniorRateBps,
  juniorRateBps
}: DepositFormProps) {
  const amountFieldId = useId();
  const [hasMounted, setHasMounted] = useState(false);
  const [tranche, setTranche] = useState<TrancheKey>('senior');
  const [amount, setAmount] = useState('');

  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { writeContract, isPending, error } = useWriteContract();

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const rateBps = BigInt(tranche === 'senior' ? seniorRateBps : juniorRateBps);
  const principal = toWei(amount);
  const entitlement = principal === null ? null : applyRateBps(principal, rateBps);
  const isAmountInvalid = amount.trim() !== '' && principal === null;

  const isWrongChain = hasMounted && isConnected && chainId !== creditcoinCc3Chain.id;
  const blockedReason =
    waterfallAddress === null
      ? DEPOSITS_DISABLED_NOT_DEPLOYED
      : !hasMounted || !isConnected
        ? DEPOSITS_DISABLED_NO_WALLET
        : isWrongChain
          ? DEPOSITS_DISABLED_WRONG_CHAIN
          : null;

  const canSubmit =
    blockedReason === null && principal !== null && principal > 0n && !isPending;

  const submit = () => {
    if (waterfallAddress === null || principal === null || principal <= 0n) return;
    writeContract({
      abi: trancheWaterfallAbi,
      address: waterfallAddress,
      args: [TRANCHE_ORDINAL[tranche]],
      chainId: creditcoinCc3Chain.id,
      functionName: 'deposit',
      value: principal
    });
  };

  return (
    <section
      aria-label="Deposit into a tranche"
      className="mx-auto w-full max-w-container px-6 pb-16 md:px-12 md:pb-24"
    >
      <div className="border-t border-khmBorder pt-6">
        <h2 className="label-utility text-khmDark">Deposit</h2>

        <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-12">
          <div className="md:col-span-6">
            <div
              aria-label="Tranche"
              className="flex items-center space-x-3 text-xs font-medium tracking-wider"
              role="group"
            >
              {(['senior', 'junior'] as const).map((option, index) => (
                <span className="flex items-center space-x-3" key={option}>
                  {index > 0 ? <span className="text-khmGray">/</span> : null}
                  <button
                    aria-pressed={tranche === option}
                    className={`cursor-pointer uppercase tracking-wider transition-colors ${
                      tranche === option
                        ? 'font-semibold text-khmDark'
                        : 'text-khmGray hover:text-khmDark'
                    }`}
                    onClick={() => setTranche(option)}
                    type="button"
                  >
                    {option}
                  </button>
                </span>
              ))}
            </div>

            <label className="label-utility mt-8 block text-khmGray" htmlFor={amountFieldId}>
              Amount
            </label>
            <div className="flex items-baseline gap-3">
              <input
                aria-invalid={isAmountInvalid}
                className="underline-input w-full"
                disabled={blockedReason !== null}
                id={amountFieldId}
                inputMode="decimal"
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                value={amount}
              />
              <span className="label-utility shrink-0 text-khmGray">
                {creditcoinCc3.currencySymbol}
              </span>
            </div>
            {isAmountInvalid ? (
              <p className="label-utility mt-2 text-khmAlert">
                Enter a positive decimal amount.
              </p>
            ) : null}

            <div className="mt-8">
              <button
                className="button-primary"
                disabled={!canSubmit}
                onClick={submit}
                type="button"
              >
                {isPending ? 'Confirming…' : 'Record deposit'}
              </button>
              {blockedReason !== null ? (
                <p className="label-utility mt-3 max-w-[52ch] text-khmGray">{blockedReason}</p>
              ) : null}
              {isWrongChain ? (
                <button
                  className="label-utility mt-3 block text-khmDark transition-opacity hover:opacity-70"
                  onClick={() => switchChain({ chainId: creditcoinCc3Chain.id })}
                  type="button"
                >
                  Switch to {creditcoinCc3.shortName}
                </button>
              ) : null}
              {error !== null ? (
                <p className="label-utility mt-3 max-w-[52ch] text-khmAlert">
                  The wallet did not submit this deposit.
                </p>
              ) : null}
            </div>
          </div>

          <div className="md:col-span-6">
            <p className="figure-sm text-khmDark">
              You deposit{' '}
              {principal === null ? '———' : formatTokenAmount(principal)}{' '}
              {creditcoinCc3.currencySymbol} · Your entitlement{' '}
              {entitlement === null ? '———' : formatTokenAmount(entitlement)}{' '}
              {creditcoinCc3.currencySymbol} ({tranche}, {formatRateMultiplier(rateBps)}×)
            </p>
            <p className="mt-4 max-w-[46ch] text-[15px] leading-snug text-khmGray">
              {FIXED_RULE_SENTENCE}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
