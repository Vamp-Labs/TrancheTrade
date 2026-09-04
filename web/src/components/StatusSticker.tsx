interface StatusStickerProps {
  children: string;
}

export function StatusSticker({ children }: StatusStickerProps) {
  return (
    <div className="status-sticker whitespace-nowrap border border-khmBorder/80 bg-[#f9f8f4] px-2.5 py-0.5 text-[11px] text-khmDark/80">
      {children}
    </div>
  );
}
