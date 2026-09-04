import { AuditTable } from '@/components/AuditTable';
import { ALLOCATION_NATURE_SENTENCE, SYNTHETIC_DATA_DISCLOSURE } from '@/lib/copy';
import { cyclesOldestFirst, resolveManifest } from '@/lib/manifest';

export default function ActivityPage() {
  const resolved = resolveManifest();
  const cycles = cyclesOldestFirst(resolved.manifest);
  const allocationCount = cycles.filter((cycle) => cycle.allocation !== null).length;
  const rejectionCount = cycles.length - allocationCount;

  return (
    <section
      aria-label="Audit trail"
      className="mx-auto w-full max-w-container px-6 pb-16 md:px-12 md:pb-24"
    >
      <div className="grid grid-cols-1 items-baseline gap-6 pb-16 md:grid-cols-12 md:pb-24">
        <div className="md:col-span-3 md:pt-6">
          <p className="label-utility text-khmGray">Audit trail</p>
          <p className="label-utility mt-3 text-khmGray">{SYNTHETIC_DATA_DISCLOSURE}</p>
        </div>
        <h1 className="main-title font-serif text-khmDark md:col-span-6">Every attempt.</h1>
        <div className="text-left md:col-span-3 md:pt-6 md:text-right">
          <p className="label-utility text-khmGray">Recorded cycles</p>
          <p className="figure-md mt-3 text-khmDark">{cycles.length}</p>
          <p className="label-utility mt-3 text-khmGray">
            {allocationCount} allocated · {rejectionCount} rejected
          </p>
        </div>
      </div>

      <AuditTable cycles={cycles} hashesAreLinkable={resolved.origin === 'live'} />

      <p className="mt-8 max-w-[72ch] text-[15px] leading-snug text-khmGray">
        {ALLOCATION_NATURE_SENTENCE}
      </p>
      <p className="label-utility mt-3 text-khmGray">Source · {resolved.sourcePath}</p>
    </section>
  );
}
