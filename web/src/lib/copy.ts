export const REJECTION_MESSAGE =
  'Attestation failed — balances held at prior state, no funds moved.';

export const REPLAY_SUPPORTING_LINE = 'This attestation was already applied.';

export const FIXED_RULE_SENTENCE =
  'A single fixed disclosed rule. Not a credit score and not a risk model.';

export const SYNTHETIC_DATA_DISCLOSURE = 'Testnet — synthetic invoice data';

export const SENIOR_SENTENCE = 'Paid first from every attested repayment.';

export const JUNIOR_SENTENCE = 'Paid only after the senior tranche is fully satisfied.';

export const ALLOCATION_NATURE_SENTENCE =
  'An allocation is an accounting entitlement recorded against an attested repayment event. It is not a transfer of repayment cash.';

export const ORIGINALITY_CLAIM =
  'The narrow claim: an established senior/junior waterfall applied to an Attestcoin-attested on-chain trade-finance repayment event.';

export const FOOTER_DISCLOSURE =
  'Testnet demonstration on synthetic invoice data. Not an offering of any kind and not a solicitation. Tranche entitlements are accounting positions in a testnet contract.';

export const NOT_DEPLOYED_HEADLINE = 'Not yet deployed';

export const NOT_DEPLOYED_BODY =
  'No TrancheTrade contract address has been recorded in docs/evidence/deployments.json, so no chain state can be read. Every figure below is drawn from the committed fixture manifest and is labelled as such.';

export const FIXTURE_BANNER_HEADLINE = 'Fixture data';

export const FIXTURE_BANNER_BODY =
  'Every figure, hash, balance and timestamp on this screen comes from web/fixtures/transactions.fixture.json. None of it was produced by a transaction. Synthetic hashes are shaped 0x0000…00NN and are not linked to any explorer.';

export const EMPTY_ALLOCATIONS_HEADLINE = 'No allocations yet.';

export const EMPTY_ALLOCATIONS_BODY = 'Waiting for the first attested repayment event.';

export const DEPOSITS_DISABLED_NOT_DEPLOYED =
  'The TrancheWaterfall contract is not yet deployed on Creditcoin CC3, so no deposit can be sent.';

export const DEPOSITS_DISABLED_NO_WALLET = 'Connect a wallet to record a deposit.';

export const DEPOSITS_DISABLED_WRONG_CHAIN =
  'The connected wallet is on another network. Switch to Creditcoin CC3 Testnet to continue.';

export const TRANCHE_STRUCTURE_SUFFIX = 'FIXED AT DEPLOYMENT · IMMUTABLE';
