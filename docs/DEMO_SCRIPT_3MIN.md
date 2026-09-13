# TrancheTrade — 3-Minute Demo Video Script (English)

Everything referenced here is **live on real testnets** (Ethereum Sepolia + Creditcoin CC3).
No mocks, no fixtures — the deployed app reads the same `docs/evidence/transactions.json`
manifest that `docs/evidence/judge-verification.md` walks hash-by-hash. This is a tight, timed
cut of that full walkthrough — use this file when you're recording, use the judge-verification
doc for reference/Q&A prep.

**Total runtime target: 3:00.** Practice it once with a stopwatch before the real take — this
script has almost no slack.

---

## 0. One-line pitch (memorize this, say it early)

> "TrancheTrade lets a real attested trade-finance repayment flow through a hard-capped
> senior/junior waterfall — senior investors paid first, junior second, and the contract fails
> closed on any bad or replayed attestation. One attested repayment. A waterfall, not a flat
> rate."

---

## 1. What to show, second by second

Every step below is one of three explicit actions:
- **POINT AT** — hold the cursor / mouse-highlight over this element while you talk, don't click it
- **CLICK** — actually click this exact element, it navigates or changes state
- **SAY** — the line to speak while that element is on screen

Every label named is the **exact on-screen text**, verified against the live component code
(not guessed), so you know precisely where the cursor goes at each timestamp.

### 0:00–0:15 — Cold open

- Have `https://tranhetrade-production.up.railway.app/` already loaded, no click yet.
- **POINT AT** the display heading **"Senior first, then junior."** in the centre of the hero.
- **SAY:** "An exporter's invoice gets funded through a Creditcoin trade-finance pool. Today,
  every investor in that pool gets the same blended rate. TrancheTrade fixes that with one
  attested repayment and a waterfall, not a flat rate."

### 0:15–0:35 — The fixed two-tranche structure

1. **POINT AT** the **"I"** panel (top rule is a solid **2px** line) labelled **"SENIOR"**, then
   the **"II"** panel (thinner **1px** rule) labelled **"JUNIOR"** — don't click, just trace the
   weight difference between the two top rules with the cursor.
2. **POINT AT** the sentence under the senior figure: **"Paid first from every attested
   repayment."**, then the one under junior: **"Paid only after the senior tranche is fully
   satisfied."**
3. **POINT AT** the line below both panels: **"Tranche structure — 2 of 2 · FIXED AT
   DEPLOYMENT · IMMUTABLE"**.
   **SAY:** "Real trade finance already solved undifferentiated pooling with tranching — senior
   capital protected first, junior capital absorbing first-loss risk for a higher return.
   TrancheTrade brings that on-chain, and the two-tranche cap is enforced in code, not policy."

### 0:35–1:10 ⭐ — Prove a real senior-only allocation, live

1. Scroll down to the **"Beat region"** below the tranche panels (the area with the
   **"Attestation"** label).
2. **CLICK** the button **"Replay recorded sequence"**.
3. **POINT AT** the **"I" (senior) panel** as its top rule sweeps and its outstanding figure
   counts down from `3,180.00` to `1,180.00` — the **"II" (junior) panel stays completely
   still**, no movement of any kind.
4. **POINT AT** the header line that appears above the panels: **attestation id**, the
   **"Allocated"** badge, and **"Attested amount 2,000.00 tCTC"** — then the two hash links
   labelled **CC3** and **SEPOLIA** underneath.
   **SAY the mandatory line, verbatim:** **"Senior updates first. Then junior. Exactly as
   attested."** *(here junior's beat still runs and resolves to the same value — narrate: "and
   junior still gets its beat, showing nothing moved, because senior wasn't exhausted yet.")*

### 1:10–1:30 ⭐⭐ — The core moment: senior exhausts, spills into junior

1. **CLICK** the button (now labelled) **"Play recorded cycle 2"**.
2. **POINT AT** the **senior panel** sweeping first — its outstanding figure closes
   `1,180.00 → 0.00` — then, after a visible pause, **POINT AT** the **junior panel** sweeping —
   its outstanding figure moves `1,180.00 → 860.00`.
3. **POINT AT** the **"Attested amount 1,500.00 tCTC"** line in the header above.
   **SAY:** "Watch closely — senior closes out completely, and only the remainder spills into
   junior, inside the same transaction, in strict order. That ordering isn't animation for
   effect — it's read directly from the on-chain event log, `SeniorAllocated` before
   `JuniorAllocated`, every time."

### 1:30–1:55 — Fail-closed, live

1. **CLICK** the button **"Play recorded cycle 3"**.
2. **POINT AT** the region that replaces the beat area — eyebrow text **"REJECTED"**, then the
   exact sentence: **"Attestation failed — balances held at prior state, no funds moved."**
3. **POINT AT** the decoded line underneath: **`AttestationFailed(…, VerifierReverted)`**, then
   the two rows **"Senior outstanding"** and **"Junior outstanding"**, each showing the same
   value on both sides of the arrow with the word **"unchanged"** next to it.
4. **POINT AT** the link at the bottom: **"Reverted transaction on Creditcoin CC3 Testnet"**.
   **SAY the mandatory line, verbatim:** **"Attestation failed — balances held at prior state.
   No funds moved."** Then: "No spinner, no silent retry, no partial write. It fails closed,
   completely, every time — this is a corrupted continuity proof, rejected by the verifier
   itself before any state write."

### 1:55–2:15 — Replay protection

1. **CLICK** the button **"Play recorded cycle 4"**.
2. **POINT AT** the same rejection layout, but now the supporting line underneath the main
   sentence reads: **"This attestation was already applied."**, and the decoded line reads
   **`AttestationFailed(…, AlreadyApplied)`**.
   **SAY the mandatory line, verbatim:** **"The same attestation cannot be applied twice."**
   Then: "Same component, reused — this isn't a special-cased UI state, it's the identical
   rejection path as the corrupted-proof case."

### 2:15–2:45 ⭐ — Close on the audit trail

1. **CLICK** the button **"Return to current balances"** to reset the beat region.
2. **CLICK** the link **"Full audit trail"** at the bottom of the recent-activity section.
3. On `/activity`, **POINT AT** the table header row: **When / Cycle / Invoice / Attested /
   Senior / Junior / Result / Sepolia / Attestation / Creditcoin**.
4. **POINT AT** the two rejected rows — their **Senior** and **Junior** columns show **`—`**,
   not `0`, and their **Result** column reads **"Rejected · VerifierReverted"** /
   **"Rejected · AlreadyApplied"** in a different colour than the **"Allocated"** rows.
5. **CLICK** the cycle id link **`cycle-2`** to open its full trace.
6. **POINT AT** the three numbered hops — **"1 Ethereum Sepolia"**, **"2 Attestcoin
   attestation"**, **"3 Creditcoin CC3 Testnet"** — and specifically the **repayment amount**
   shown at hop 1 and the **attested amount applied** shown at hop 3: both read
   **`1,500.00`**, same number, two chains.
   **SAY:** "Every allocation and every rejection is traceable — Sepolia repayment, Attestcoin
   proof, Creditcoin allocation, all linked. A judge doesn't have to trust us; every hash here
   is independently verifiable on a public explorer."

### 2:45–3:00 — Close

- **CLICK** back to `/`. Static frame, no further clicks.
- **SAY:** "Every other attested-event product in this field gives you one number. TrancheTrade
  gives you a waterfall — verified, ordered, and provably safe to fail. One attested repayment.
  A waterfall, not a flat rate."

> **Note on the deposit flow:** the **"Deposit"** section with the senior/junior toggle and
> **"Record deposit"** button is real — it fires an actual `deposit()` call through a connected
> wallet on Creditcoin CC3 (chain id `102031`). Don't perform it live in the 3-minute cut; a
> wallet-connect and network-switch prompt eats 20–30s for no new information. Mention it
> exists in one sentence if time allows, don't click into it.

---

## 2. Exact data to have ready in tabs before you hit record

Open these **before** recording so you never wait on-screen:

1. **Tab 1 — the live app**
   `https://tranhetrade-production.up.railway.app/`
   (scroll once before recording so you know exactly where the **"Replay recorded sequence"**
   button sits in the beat region — don't hunt for it on camera)
2. **Tab 2 — Sepolia Etherscan**, pre-searched for tx
   `0x3ac3a2eb08bb64d4b7d27860769ac8558c16f5423ff623dd05b63ce30f2eefa9` (cycle-2's repayment,
   the one you'll trace at the end)
3. **Tab 3 — Creditcoin CC3 Blockscout**, pre-searched for tx
   `0x93f2afba1b375d03f33a254ba24fadb0aa121cd824d4c69d491c777e12487632` (cycle-2's allocation —
   as a fallback if you want to show the raw `SeniorAllocated`/`JuniorAllocated` log ordering
   directly on the explorer instead of narrating it)
4. **No wallet needed.** Every beat in this script reads the recorded manifest through the
   **"Replay recorded sequence"** control — nothing requires a connected wallet except the
   deposit flow, which this script does not perform live (see the note above).

The whole demo needs **no typing at all**: every beat is one button click —
**"Replay recorded sequence"** → **"Play recorded cycle 2"** → **"Play recorded cycle 3"** →
**"Play recorded cycle 4"** → **"Return to current balances"**.

---

## 3. Component-by-component cut list

If you'd rather record in short clips and edit together, here's the minimal shot list:

1. **Shot A** — Hero, **"Senior first, then junior."**, then the two tranche panels with their
   top-rule weight difference and seniority sentences (10–12s)
2. **Shot B** — Click **"Replay recorded sequence"**, senior panel sweep, junior panel inert,
   header showing **"Allocated"** + attested amount `2,000.00 tCTC` (10–12s)
3. **Shot C** — Click **"Play recorded cycle 2"**, both beats firing in strict order — senior
   closes to `0.00`, junior spills to `860.00` (10–12s)
4. **Shot D** — Click **"Play recorded cycle 3"**, the rejection panel with the exact mandated
   string and the unchanged before/after values (10–12s)
5. **Shot E** — Click **"Play recorded cycle 4"**, the replay rejection with
   **"This attestation was already applied."** (8–10s)
6. **Shot F** — `/activity` table, rejected rows showing `—` instead of `0`, then
   `/activity/cycle-2` with all three hops and matching amounts (15–18s)
7. **Shot G** — Closing frame on `/` while you deliver the summary line (10s)

Total raw footage needed: ~65–80s of actual on-screen action; the rest is voiceover pacing —
record it slightly loose and trim in the edit, since 3:00 is a hard ceiling for most hackathon
submission forms.

---

## 4. What to explicitly NOT do in a 3-minute cut

- Don't wait for a real, fresh Attestcoin attestation on camera (checkpoints every ~20 minutes)
  — the four recorded cycles behind **"Replay recorded sequence"** already carry real,
  independently verifiable transaction hashes; use those.
- Don't perform the deposit flow live — it needs a connected wallet and a network-switch
  prompt, and adds no new information the tranche panels haven't already shown.
- Don't read every column of the audit table out loud — point at the **Senior/Junior `—`**
  distinction and the **Result** column once, that's the whole point of the table.
- Don't explain Attestcoin's internal mechanics (continuity proofs, checkpoints, the block
  prover precompile) beyond one sentence — save that for Q&A, not the pitch. See
  `docs/evidence/judge-verification.md` §4 for the full verified detail if a judge asks.
- Don't claim this "prevents a crisis" — the trade-finance gap is a chronic structural
  problem, not a single averted incident (PRD §3.5).

---

## 5. 30-second fallback (if a judge asks "give me the 10-second version")

> "One attested repayment. A hard-capped waterfall — senior investors paid first, junior
> second, enforced in code, not policy. Feed it a bad or replayed attestation and it fails
> closed — no partial write, balances held exactly where they were. It's live right now on
> Ethereum Sepolia and Creditcoin CC3, not a mockup."

---

## 6. If something breaks mid-recording

- **Page won't load / blank screen** → reload once; if the Railway service went idle, the
  first request can take a few seconds to cold-start — reload again rather than narrating over
  a blank page.
- **"Replay recorded sequence" doesn't animate** → the four cycles are baked into the deployed
  build from `docs/evidence/transactions.json` at build time, so this should never depend on
  live chain state — if it still doesn't fire, cut to `/activity/cycle-2` and narrate over the
  static trace instead of debugging on camera.
- **Explorer tx page slow to load** → have Tabs 2 and 3 already open and pre-searched (see
  section 2) so you never wait on a network fetch during the take.
- **A judge asks to see it fail live instead of replayed** → point out that
  "Play recorded cycle 3" and "cycle 4" are real, previously-broadcast, reverted transactions
  on Creditcoin CC3 (not simulated locally) — open the reverted tx hash from
  `docs/evidence/transactions.json` directly on Blockscout if they want to verify the revert
  themselves.
