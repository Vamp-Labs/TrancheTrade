import { formatUnits, parseUnits } from 'viem';
import protocol from '@config/protocol.json';

export const TOKEN_DECIMALS = protocol.tokenDecimals;
export const DISPLAY_FRACTION_DIGITS = protocol.displayFractionDigits;
export const BPS_DENOMINATOR = BigInt(protocol.bpsDenominator);

export const ELLIPSIS = '…';
export const RIGHT_ARROW = '→';
export const EXTERNAL_LINK_MARK = '↗';

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatTokenAmount(
  value: bigint,
  fractionDigits: number = DISPLAY_FRACTION_DIGITS
): string {
  const asDecimal = formatUnits(value, TOKEN_DECIMALS);
  const negative = asDecimal.startsWith('-');
  const unsigned = negative ? asDecimal.slice(1) : asDecimal;
  const separatorIndex = unsigned.indexOf('.');
  const wholePart = separatorIndex === -1 ? unsigned : unsigned.slice(0, separatorIndex);
  const fractionPart = separatorIndex === -1 ? '' : unsigned.slice(separatorIndex + 1);
  const grouped = groupThousands(wholePart);
  if (fractionDigits === 0) return `${negative ? '-' : ''}${grouped}`;
  const padded = `${fractionPart}${'0'.repeat(fractionDigits)}`.slice(0, fractionDigits);
  return `${negative ? '-' : ''}${grouped}.${padded}`;
}

export function toWei(decimalInput: string): bigint | null {
  const trimmed = decimalInput.trim();
  if (trimmed === '' || !/^\d+(\.\d+)?$/.test(trimmed)) return null;
  try {
    return parseUnits(trimmed, TOKEN_DECIMALS);
  } catch {
    return null;
  }
}

export function toBigIntOrNull(decimalString: string): bigint | null {
  if (!/^-?\d+$/.test(decimalString)) return null;
  return BigInt(decimalString);
}

export function truncateHash(hash: string, leadingHexDigits = 4, trailingHexDigits = 4): string {
  const withoutPrefix = hash.startsWith('0x') ? hash.slice(2) : hash;
  if (withoutPrefix.length <= leadingHexDigits + trailingHexDigits) return hash;
  const head = withoutPrefix.slice(0, leadingHexDigits);
  const tail = withoutPrefix.slice(withoutPrefix.length - trailingHexDigits);
  return `0x${head}${ELLIPSIS}${tail}`;
}

export function applyRateBps(principal: bigint, rateBps: bigint): bigint {
  return (principal * rateBps) / BPS_DENOMINATOR;
}

export function reverseRateBps(entitlement: bigint, rateBps: bigint): bigint {
  if (rateBps === 0n) return 0n;
  return (entitlement * BPS_DENOMINATOR) / rateBps;
}

export function formatRateMultiplier(rateBps: bigint): string {
  const whole = rateBps / BPS_DENOMINATOR;
  const fraction = rateBps % BPS_DENOMINATOR;
  const fractionText = fraction.toString().padStart(4, '0').replace(/0+$/, '');
  return fractionText === '' ? `${whole}` : `${whole}.${fractionText}`;
}

export function formatTimestamp(isoTimestamp: string): string {
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) return isoTimestamp;
  const year = parsed.getUTCFullYear();
  const month = `${parsed.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${parsed.getUTCDate()}`.padStart(2, '0');
  const hours = `${parsed.getUTCHours()}`.padStart(2, '0');
  const minutes = `${parsed.getUTCMinutes()}`.padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
}
