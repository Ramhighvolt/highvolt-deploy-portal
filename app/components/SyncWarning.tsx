type SyncWarningProps = {
  visible: boolean;
};

export default function SyncWarning({ visible }: SyncWarningProps) {
  if (!visible) return null;

  return (
    <div className="flex items-center gap-2.5 border-b border-amber-500/15 bg-amber-500/[0.06] px-4 py-2">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500 pipeline-active" />
      <p className="sys-label !text-[0.5625rem] !tracking-[0.1em] text-amber-400/90">
        Status sync interrupted. Retrying automatically…
      </p>
    </div>
  );
}
