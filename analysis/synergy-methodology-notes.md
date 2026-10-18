# Synergy simulation methodology notes

Scope: methodological recommendations, not evidence that a particular estimator is accurate. Inspected repository code on 2026-10-15; no product code changed. The proposed shared pair score is signed and zero-centered, primarily recency-weighted actual wins minus pre-match win probability, with score margin secondary and raw win rate contextual.

## What the current code establishes

- [`rating.ts`](../src/lib/matchmaking/rating.ts) averages the two individual ratings, applies `1 / (1 + 10 ** ((opponentRating - ownRating) / 400))`, and gives both teammates the same Elo update. It consumes only the winner, not points. Its function name `expectedScore` means expected binary result here, not expected pickleball points.
- [`calculator.ts`](../src/lib/synergy/calculator.ts) currently computes rounded Laplace-smoothed win percentage `(wins + 1) / (matches + 2)`; that measures pair success, not above-expectation chemistry.
- [`rating-replay.ts`](../src/lib/domain/rating-replay.ts) reconstructs ratings chronologically, shares account ratings across groups, and records pre-match snapshots. Corrections can therefore alter later expected outcomes. [`types.ts`](../src/lib/domain/types.ts) includes match points, completion times, and rating snapshots. [`session-service.ts`](../src/lib/domain/session-service.ts) records pair win/loss outcomes on completed rounds. A residual-based experiment needs the individual match history, not just pair aggregate wins.

## Main identification risks

1. **Opponent chemistry is part of the residual.** A team can underperform because its opponent has unusually good chemistry. In a model `logit(P(A wins)) = baselineRatingDifference + chemistry(A) - chemistry(B)`, an individual residual cannot identify the two chemistry terms separately. Rotate opponents and partners, vary the schedule graph, and test strong opposing pairs explicitly. Treat the score as observed above-expectation performance under encountered schedules unless a jointly fitted model demonstrates recoverability.
2. **Individual ratings absorb chemistry.** Since teammates receive the same result-driven Elo update, a frequently successful fixed pair raises both individual ratings. Their later expected probability rises, reducing their residual even if their underlying chemistry persists. Conversely, switching partners can carry that inflated expectation into another pair. Compare oracle fixed individual skill, frozen estimated skill, online Elo, and jointly estimated player/pair effects. Report ability to recover a persistent pair effect over time, not just early detection. This risk follows directly from the update rule above.
3. **A zero residual requires a calibrated baseline.** With `r = y - p`, `E[r] = q - p` when true win probability is `q`. Positive residual can mean chemistry, underestimated individual skill, or miscalibration. Sweep newcomers, skill drift, unequal teammate strengths, mismatched groups, and systematic Elo-scale errors. Check calibration and proper prediction losses separately from pair rankings.
4. **Residual size depends on opposition.** A fixed additive log-odds chemistry effect gives different `q - p` at baseline 0.5 versus 0.95. Residual points are a probability-scale performance measure, not an opponent-independent latent ability. Include easy and hard schedules; avoid claiming a universal chemistry magnitude from the residual alone.

## Recency and uncertainty

For pair-game age `k`, use `w_k = 2 ** (-k / h)` and normalize the weighted mean residual by `sum(w)`. Declare whether age counts pair games, player games, or calendar time: these have different meanings for irregular attendance. Pair-game decay does not make an inactive pair stale in calendar time.

A useful diagnostic is `n_eff = (sum(w)) ** 2 / sum(w ** 2)`. For an indefinitely long geometric history with `lambda = 2 ** (-1/h)`, this tends to `(1 + lambda)/(1 - lambda)`: approximately **11.57, 17.33, and 28.87** for half-lives **4, 6, and 10 pair games**. These are algebraic derivations, not empirical confidence guarantees. For finite histories calculate the sums exactly. Normalizing a single observation still leaves one observation; half-life six does not imply six independent games.

Under fixed known probabilities and independent outcomes, conditional variance of the weighted mean is `sum(w_i ** 2 * p_i * (1-p_i)) / sum(w_i) ** 2`. Real uncertainty also includes baseline-rating error, correlated sessions, and schedule selection. Opposing residuals from the same game are exact negatives, not independent evidence. Prefer uncertainty coverage measured across independent simulated leagues, with session-block sensitivity analysis, over naive match bootstrap intervals. Evaluate false positive rates and interval coverage under zero chemistry, sparse pairs, and repeated sessions. Shrink sparse pair estimates toward zero; do not label them confidently neutral. A tie-breaker based on win rate can reintroduce schedule bias, so keep its influence bounded and disclosed.

## Score margin cannot be inferred from Elo probability alone

A binary probability fixes only the chance that margin is positive; it does not fix the distribution or mean of the margin. Many margin distributions have the same win probability and different expected margins. Therefore `2p - 1`, or any scaled version of it, is not a justified expected pickleball score margin merely because Elo supplies `p`.

For an experimental secondary metric, either fit expected normalized margin to pre-match rating difference using chronological training/validation data, or specify an explicit point/rally scoring process with serving, side-out versus rally rules, game target and win-by-two. Validate that model separately. Do not compute expected margin from the observed final total without testing outcome-dependent denominator bias. Margin and victory are correlated evidence; adding them does not create extra independent games. Test whether margin improves held-out inference beyond win residual alone and cap its contribution so a few extreme scores cannot dominate. Current domain validation allows nonnegative unequal integer scores; do not assume every stored match follows a single target-score rule without checking data.

## Simulation experiments that can falsify the proposal

- **Null:** zero pair chemistry, varied schedules and baseline miscalibration. Measure spurious positive/negative labels and selection bias from choosing the best partner.
- **Known signal:** weak/strong positive and negative pair effects; mixed opponent effects; fixed-pair versus rotating schedules. Measure signed bias, rank recovery, detection delay, false discoveries, and uncertainty coverage.
- **Absorption:** a persistent pair effect followed by partner swaps, with oracle, frozen, and updating ratings. Quantify loss of signal and spillover to unrelated partners.
- **Change:** chemistry switches sign or fades; compare half-lives 4/6/10 on response delay versus noise. Include long inactivity and sparse pair histories.
- **Misspecification:** generate games using a different model from the estimator, including player-specific skill drift, teammate imbalance, session shocks, and a point-level scoring process. Generating and evaluating with the same Elo-plus-pair formula tests implementation consistency, not external validity.
- **Chronological holdout:** tune scaling, shrinkage, half-life and any margin blend only on training runs/data; report held-out independent seeds/leagues and later real matches. Report prediction quality and recovery of injected chemistry separately: a useful descriptive pair score need not be a calibrated causal chemistry estimator.

All statistical claims above are explicit model assumptions or algebraic consequences, not conclusions established by this repository or by observed player data. Product validation still requires independent data, and causal chemistry remains limited by nonrandom partner/opponent assignment.
