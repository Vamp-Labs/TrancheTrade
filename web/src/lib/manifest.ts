import fixtureJson from '@fixtures/transactions.fixture.json';
import evidenceJson from '@evidence/transactions.json';
import { parseTransactionManifest, type TransactionManifest } from '@/lib/manifest-schema';

export type ManifestOrigin = 'live' | 'fixture';

export interface ResolvedManifest {
  origin: ManifestOrigin;
  sourcePath: string;
  manifest: TransactionManifest;
  liveManifestProblem: string | null;
}

const EMPTY_MANIFEST: TransactionManifest = {
  version: 1,
  generatedAt: '',
  commit: null,
  contracts: {
    invoiceRegistry: { chainId: 0, address: null },
    trancheWaterfall: { chainId: 0, address: null },
    attestcoinVerifier: { chainId: 0, address: null }
  },
  cycles: []
};

const FIXTURE_PATH = 'web/fixtures/transactions.fixture.json';
const EVIDENCE_PATH = 'docs/evidence/transactions.json';

function requestedMode(): 'auto' | ManifestOrigin {
  const configured = process.env.NEXT_PUBLIC_DATA_SOURCE;
  if (configured === 'live' || configured === 'fixture') return configured;
  return 'auto';
}

export function resolveManifest(): ResolvedManifest {
  const mode = requestedMode();
  const live = parseTransactionManifest(evidenceJson as unknown);
  const fixture = parseTransactionManifest(fixtureJson as unknown);
  const liveProblem = live.ok ? null : live.problem;

  const fixtureManifest = fixture.ok ? fixture.manifest : EMPTY_MANIFEST;

  if (mode === 'fixture') {
    return {
      origin: 'fixture',
      sourcePath: FIXTURE_PATH,
      manifest: fixtureManifest,
      liveManifestProblem: liveProblem
    };
  }

  if (live.ok && (mode === 'live' || live.manifest.cycles.length > 0)) {
    return {
      origin: 'live',
      sourcePath: EVIDENCE_PATH,
      manifest: live.manifest,
      liveManifestProblem: null
    };
  }

  return {
    origin: 'fixture',
    sourcePath: FIXTURE_PATH,
    manifest: fixtureManifest,
    liveManifestProblem: liveProblem
  };
}

export function cyclesNewestFirst(manifest: TransactionManifest) {
  return [...manifest.cycles].sort((left, right) =>
    right.occurredAt.localeCompare(left.occurredAt)
  );
}

export function cyclesOldestFirst(manifest: TransactionManifest) {
  return [...manifest.cycles].sort((left, right) =>
    left.occurredAt.localeCompare(right.occurredAt)
  );
}
