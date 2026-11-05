# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary User**: Group Organizers / Hosts running recreational pickleball sessions on mobile phones courtside.
- **Secondary User**: Group Players checking court assignments, viewing partner/opponent matchups, monitoring chemistry/synergy, and managing profile privacy.
- **Operating Situation**: Recurring casual and semi-competitive social groups (typically 6–24 players across 2–4 courts) playing outdoors on physical courts in bright daylight.

## Product Purpose

Pickleball Matchmaker replaces manual, flawed team-creation methods (like paddle stacking or hand-flipping) with an instant (< 500 ms) automated doubles matchmaking engine. It ensures everyone gets fair playing time, varied partners, diverse opponents, and balanced games without organizational friction or delay.

## Positioning

Combines rigorous mathematical fairness (lexicographic prioritization of sit equity, partner/opponent variety, dynamic ratings, deterministic rating replay, and Bayesian Laplace partner synergy) with an outdoor-optimized, zero-friction mobile interface. Unlike generic bracket or league software, it preserves social randomness and camaraderie while eliminating administrative overhead on court.

## Operating Context

- **Environment**: Bright outdoor courts with direct sunlight, glare, and active physical play.
- **Device & Usage**: Handheld mobile devices, often used one-handed between points or games.
- **Rituals**: Weekly or bi-weekly group sessions; quick attendance check-in, immediate round generation, quick score entry, and mid-session arrivals/departures.

## Capabilities and Constraints

- **Lexicographic Fairness Priority**:
  1. Sit equity (no player sits twice until all eligible players have sat)
  2. Court utilization (maximize active courts)
  3. Partnership variation (minimize repeat partners)
  4. Opponent variation (minimize repeat opponents)
  5. Competitive balance (dynamic skill rating alignment)
- **Partner Chemistry & Synergy**: Bayesian Laplace-smoothed synergy scores (`(wins + 1) / (matches + 2)`) tracking shared chemistry across pairings.
- **Deterministic Rating Replay**: Any historical score correction, cancellation, or round undo deterministically recomputes ratings from the beginning of history.
- **Authentication**: Lightweight 4-digit PIN for group organizers; player authentication for personal profile and group membership management.
- **Privacy Model**: Decoupled profile visibility policies (public, group-only, or private) for player ratings, stats, and synergy badges.
- **Installability**: Installable mobile PWA ("Add to Home Screen").

## Brand Commitments

- **Tone & Voice**: Pragmatic, direct, energetic, and unobtrusive. The interface gets out of the way so players focus on playing.
- **Identity & Aesthetics**: Dark, high-contrast palette (`slate-950`), large tap targets, high outdoor legibility.
- **Typography**: Atkinson Hyperlegible as the primary font family for maximum outdoor distinction and clarity.

## Evidence on Hand

- Core product requirements and specifications: [`PRD.md`](file:///Users/esthe/Documents/Work/Personal%20Projects/Pickleball-Matcher/PRD.md)
- Engineering implementation plan and status: [`IMPLEMENTATION_PLAN.md`](file:///Users/esthe/Documents/Work/Personal%20Projects/Pickleball-Matcher/IMPLEMENTATION_PLAN.md)
- Synergy and privacy architecture: [`docs/synergy-and-privacy-system.md`](file:///Users/esthe/Documents/Work/Personal%20Projects/Pickleball-Matcher/docs/synergy-and-privacy-system.md)
- Rating system documentation: [`docs/elo-rating-system.md`](file:///Users/esthe/Documents/Work/Personal%20Projects/Pickleball-Matcher/docs/elo-rating-system.md)
- Monte Carlo matchmaking simulation tests: [`tests/matchmaking/simulation.test.ts`](file:///Users/esthe/Documents/Work/Personal%20Projects/Pickleball-Matcher/tests/matchmaking/simulation.test.ts)

## Product Principles

1. **Courtside Speed Above All**: Round generation and score logging must take seconds, never halting the flow of physical court play.
2. **Transparent Fairness**: Sit distribution and pairing variation must be demonstrably equitable; algorithms serve player enjoyment, not opaque rankings.
3. **High-Contrast Legibility**: Every screen must remain effortlessly readable and operable under harsh outdoor sunlight with sweaty fingers or one-handed use.
4. **Resilient & Forgiving**: Human organizers make mistakes; historical edits, cancelled matches, and round rollbacks must be seamless, safe, and mathematically consistent.
5. **Social Camaraderie Over Cutthroat Rank**: Matchmaking encourages group mixing and chemistry development over rigid skill segmentation.

## Accessibility & Inclusion

- Adherence to WCAG 2.1 AA standards.
- High color contrast ratios (> 4.5:1 text, > 3:1 controls) optimized for direct sunlight.
- Minimum 44x44px touch targets across all mobile interactive controls.
- Screen reader accessibility and keyboard navigation verified through automated `@axe-core/playwright` audits.

