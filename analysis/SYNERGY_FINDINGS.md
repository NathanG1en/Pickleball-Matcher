# Synergy simulation findings

The signed, expectation-adjusted concept passes the main product examples.
**Six pair games remains a reasonable recency half-life to explore, but the
margin model and uncertainty need more work before changing the app.**

## Open the executed notebooks

1. [Scoring and partnership rankings](synergy_01_scoring.ipynb)
   ([readable HTML](synergy_01_scoring.html)): formula, score model, underdogs,
   strong partners, close losses, blowouts and blend comparisons.
2. [Recency and robustness](synergy_02_recency_and_robustness.ipynb)
   ([readable HTML](synergy_02_recency_and_robustness.html)): changing partnerships,
   lucky streaks, shrinkage, false best partners, Elo absorption, score-model
   failures and an independent-seed follow-up.

Both notebooks contain saved execution outputs, tables and charts. HTML copies
are self-contained and can be opened without installing Python. Exported
figures are available as PNG and SVG under [synergy_results](synergy_results/).

## What ran

- **10,964,000 sampled synthetic matches** in the final reproducible run.
  Candidate formulas reuse these observations; rescoring is not counted as new matches.
- 4,000 repeated histories per main scenario/configuration, plus a 100,000-game
  outcome/margin correlation diagnostic.
- Eight controlled partnership scenarios; histories of 2, 4, 8, 12, 20, 40, 80 games.
- Result weights 0%, 50%, 70%, 90%, 100%; priors 0, 6, 12.
- Half-lives 4, 6, 10, 20 and all-history weighting in development scenarios.
- Seed 20261015 for exploration and 20261016 for a separate follow-up stream.
- No app server, real users, group records, credentials or existing simulation
  database were accessed. Application behavior and the current synergy score
  were not changed.

## Findings

### 1. The underdog behavior works

With the original 70% result / 30% margin blend, half-life 6 and prior 6, after
20 games the mean index was:

| Partnership | Mean signed index |
| --- | ---: |
| Expected to win 85%, actually wins 85% (“LeBron”) | +0.1 |
| Expected to win 20%, actually wins 40% | +15.0 |
| Expected to win 50%, actually wins 60% | +7.6 |
| Expected to win 50%, actually wins 50% | -0.1 |
| Expected to win 60%, actually wins 40% | -14.7 |

On the separate random seed, the overperforming underdog ranked above the
expected-dominant favorite in **91.2%** of 20-game comparisons.
The cautious 90/10/prior-12 candidate ranked it correctly **90.3%**
of the time. These are synthetic ranking rates, not accuracy promises for real groups.

### 2. Close losses and blowouts move the score in the intended direction

Three scenarios reuse identical wins and losses at a calibrated 20% win chance.
Their mean 20-game scores were:

- Ordinary expected scores: +0.1.
- More competitive losses: +4.5.
- More severe blowout losses: -7.9.

Only losing points in losses are changed, and terminal scores are kept valid
under the experimental first-to-11, win-by-two rule. This isolates the score
margin effect from differences in who won.

### 3. Six-game recency is a compromise, not a discovered optimum

At the group's average 1.5 pair games per session, a six-game half-life means
about four sessions. In a long history, the latest 6/12/18 games account for
50%/75%/87.5% of influence. Short histories have different normalized shares.

Four responds faster but fluctuates more; ten is steadier but adapts more
slowly. With a six-game half-life, even a very long history has only about
**17.3 effective independent games**. The notebooks show both shrunk and
unshrunk curves so this information penalty is not confused with slow fading.

### 4. A flattering “best partner” can be mostly luck

With 16 genuinely neutral partners and 12 games per partner, the separate-seed
70/30/prior-6 benchmark selected a best score above +15 in
**61.4%** of histories. Stronger shrinkage and the 90/10 blend
reduced that to **22.0%**, still material.

+15 is only an illustrative score threshold, not a significance test.
Choosing the maximum guarantees somebody will look best. Show provisional
evidence, games together and win rate, and avoid treating a small rank gap as
proof. Session correlation also widens the observed score spread.

### 5. Expected score margin is the least validated ingredient

The experiment uses an explicit independently-awarded-point race model to map
Elo win probability to expected normalized margin. It is coherent but **not a
validated side-out pickleball model**.

When every game was systematically made wider while preserving all winners,
a calibrated neutral 20%-win pair got a mean score of -6.5 with 70/30,
versus -2.1 with 90/10. Changing the game target to 15 also changes
margin calibration. A larger margin weight can reward a scoring-model error
instead of partnership performance.

### 6. Elo can learn away persistent partnership advantage

In a deliberately extreme fixed-pair, fixed-opponent-rating stress test, the
pair kept a true 70% win chance. After 80 games, the mean score was
+15.4 using a frozen 50% baseline but +1.8 using individual
Elo updates. The ratings came to expect the persistent advantage.

This score therefore describes **recent results above current expectations**;
it does not identify a permanent causal partnership ability. A rotating league
could behave differently and needs its own experiment. Wrong individual
ratings and strong opposing partnerships can also masquerade as pair chemistry.

## Suggested next candidate

Compare **six-game half-life, 90% results / 10% margin, prior 12** with the
original 70/30/prior-6 benchmark. It keeps the requested signed, shared score
and margin sensitivity while being more conservative about an unvalidated
margin baseline. This is an exploration recommendation, not a production-ready
parameter selection. Six is a product tradeoff; these experiments cannot prove
that it or the blend weights are optimal.

Before implementation, decide whether synergy should stay positive after Elo
learns a persistent partnership advantage. If yes, consider estimating player
and pair effects together. Next validation should use a rotating-player
synthetic league with actual rating updates, and later explicitly approved
non-production data with chronological holdouts and scoring-format calibration.
No real-user data is needed to reproduce the current work.

## Reproduce

Use Python 3.12+ (tested with 3.14.3) from the repository root:

```bash
python3 -m venv /tmp/pickleball-synergy-analysis
/tmp/pickleball-synergy-analysis/bin/python -m pip install -r analysis/requirements-synergy.txt
/tmp/pickleball-synergy-analysis/bin/python analysis/synergy_simulation.py
/tmp/pickleball-synergy-analysis/bin/python analysis/build_synergy_notebooks.py
```

The simulation script writes compact aggregate CSVs and a manifest; the builder
executes both notebooks and exports HTML plus figures. The notebook cells load
those generated results rather than silently rerunning millions of matches.
All seeds, direct dependency versions and the simulation source SHA-256 are
recorded in [manifest.json](synergy_results/manifest.json). Dependencies are
analysis-only and were installed in a temporary virtual environment, with no
changes to the app's package files.

Checks include terminal probability mass, zero-centered expected margin,
team-reversal symmetry, neutral-history score, finite recency information,
legal transformed scores, notebook schema validation and execution without
error outputs. Methodological caveats and repository source references are in
[synergy-methodology-notes.md](synergy-methodology-notes.md).

No real-data validation, confidence-interval coverage claim, actual matchmaking
integration, or production score implementation is included in these notebooks.
