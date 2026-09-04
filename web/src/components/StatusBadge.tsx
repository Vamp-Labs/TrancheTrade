export type StatusBadgeVariant = 'allocated' | 'rejected' | 'pending' | 'applied' | 'failed';

const INK_BY_VARIANT: Record<StatusBadgeVariant, string> = {
  allocated: 'text-khmPositive',
  rejected: 'text-khmAlert',
  pending: 'text-khmGray',
  applied: 'text-khmGray',
  failed: 'text-khmAlert'
};

interface StatusBadgeProps {
  variant: StatusBadgeVariant;
  children: string;
}

export function StatusBadge({ variant, children }: StatusBadgeProps) {
  return (
    <span
      className={`label-utility inline-block whitespace-nowrap border border-khmBorder/80 bg-[#f9f8f4] px-2.5 py-0.5 ${INK_BY_VARIANT[variant]}`}
    >
      {children}
    </span>
  );
}
