"""Create, execute and export the two synergy notebooks. Does not run simulations.

First run synergy_simulation.py. Notebook execution uses the invoking Python via
an explicit temporary kernel spec, with no global Jupyter installation required.
"""
from pathlib import Path
import html
import json
import os
import sys
import tempfile

import markdown
import nbformat as nbf
from nbclient import NotebookClient

ROOT=Path(__file__).resolve().parent
md=nbf.v4.new_markdown_cell
code=nbf.v4.new_code_cell

SETUP='''from pathlib import Path
import json
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from IPython.display import display
import sys
BASE = Path.cwd() if Path("synergy_simulation.py").exists() else Path.cwd() / "analysis"
if not (BASE / "synergy_simulation.py").exists():
    raise FileNotFoundError("Start this notebook from the repository root or analysis directory.")
sys.path.insert(0, str(BASE.resolve()))
from synergy_simulation import ScoreModel, contributions, estimate, weights, evidence
OUT = BASE / "synergy_results"
manifest = json.loads((OUT / "manifest.json").read_text())
def load(name):
    return pd.read_csv(OUT / f"{name}.csv", keep_default_na=False)
def save(fig, name):
    fig.savefig(OUT / f"{name}.png", dpi=170, bbox_inches="tight")
    svg = OUT / f"{name}.svg"
    fig.savefig(svg, bbox_inches="tight", metadata={"Date": None})
    svg.write_text(chr(10).join(line.rstrip() for line in svg.read_text().splitlines()) + chr(10))
    plt.show()
plt.rcParams.update({"figure.figsize": (10, 5), "axes.spines.top": False,
                    "axes.spines.right": False, "axes.grid": True, "grid.alpha": .18,
                    "font.size": 11, "figure.facecolor": "white", "svg.hashsalt": "synergy-20261015"})
pd.set_option("display.max_columns", 12)
pd.set_option("display.float_format", lambda x: f"{x:.3f}")
model = ScoreModel()
print(f"Seed {manifest['seed']}; independent follow-up seed {manifest['holdout_seed']}")
print(f"{manifest['synthetic_matches']:,} synthetic matches; {manifest['repetitions']:,} histories per main cell")
print("Invariant checks:", manifest["checks"])
'''

n1=[md('''# Synergy 1 — does “beating the odds together” work?

This is an executed, offline experiment, not a change to the app. No users,
groups, credentials, or databases are read. The existing simulation notebook
and SQLite database are not used or modified.

**Design brief:** one shared signed score per partnership; zero means as
expected, positive means above expectations. Surprise wins matter most, score
margins also matter, recent pair games count more, and raw win rate is context
rather than the ranking driver. User context: around 1.5 games together per
session. The existing app uses Laplace-smoothed win rate for synergy.

**Main result:** an expected-20%, actual-40% pair can outrank an expected-85%,
actual-85% pair. But noisy “best partner” selection and baseline-rating errors
are substantial; see Notebook 2 before interpreting a score.

All tabulated means and intervals below describe repeated synthetic histories,
not evidence about real players. 5th–95th percentiles are the spread across
histories, **not confidence intervals on the displayed mean**.
'''),code(SETUP),md('''## 1. A transparent candidate formula

For completed doubles game `i`, before any post-match rating update:

- `p_i = 1 / (1 + 10 ** ((opponent_mean_rating - own_mean_rating) / 400))`.
  This matches `src/lib/matchmaking/rating.ts`.
- Result residual `r_i = win_i - p_i`.
- Normalized margin `m_i = (own_points - opponent_points) / total_points`.
- Margin residual `d_i = c * (m_i - expected_margin(p_i))`.
- Contribution `x_i = alpha * r_i + (1-alpha) * d_i`.
- Pair-game-age weights `w_i = 2 ** (-age_i / half_life)`.
- Evidence diagnostic `n_eff = sum(w)**2 / sum(w**2)`.
- Signed index `S = 100 * weighted_mean(x) * n_eff / (n_eff + prior)`.

`c` matches the per-game standard deviation of margin to the binary residual at
50/50 strength. This makes blend weights comparable around equal strength,
not at every possible probability. No clipping is used, because clipping can
shift the neutral expectation. The index is **not a percentage, probability,
or a promised [-100,100] scale**. The `prior` is a conservative heuristic,
not a fitted Bayesian posterior. Missing scores and invalid/tied games are
outside this generator; a production pipeline would need explicit policies.

For the initial benchmark: alpha 0.7, half-life 6, prior 6. Other settings are
compared using the same sampled histories, so differences are not random-run
artifacts. Raw win rate does not enter the candidate index.
'''),code('''p = np.array([.2, .5, .9, .9])
wins = np.array([1, 1, 1, 0])
display(pd.DataFrame({"expected_win_probability": p, "won": wins,
                      "result_contribution": wins-p}))
print(f"Margin normalization c = {model.margin_scale:.4f}")
'''),md('''## 2. What does expected score margin mean?

Elo supplies a game-win probability, not an expected final score. Here we make
an explicit *experimental* bridge: independently awarded points, first to 11,
win by two. An exact terminal-score distribution is computed using
negative-binomial finish probabilities and a geometric deuce tail. We invert
its game-win curve to find a point probability for each Elo probability, then
calculate expected normalized margin from the entire score distribution.

This is **not a validated side-out pickleball model**. It omits serving,
rotation, strategic play, teammate imbalance and session effects. Its role is
to make the assumptions inspectable and falsifiable. Notebook 2 changes score
shapes and target lengths to test those assumptions.

Sampling uses a 4,001-row point-probability grid; maximum adjacent game-win
probability step is recorded below. This limits tiny numerical calibration
error, not structural model error.
'''),code('''print("Maximum game-probability grid step:", manifest["grid_max_probability_step"])
fig, ax = plt.subplots(1, 2, figsize=(11, 4))
ax[0].plot(model.q, model.p, color="#176b88")
ax[0].set(xlim=(.25,.75), xlabel="Awarded-point probability (hypothesis)", ylabel="Game-win probability")
pp=np.linspace(.02,.98,200)
ax[1].plot(pp, model.expected_margin(pp), color="#98622e")
ax[1].axhline(0,color="gray",lw=.7)
ax[1].set(xlabel="Pre-match game-win probability", ylabel="Expected normalized score margin")
fig.suptitle("A model-dependent bridge from win probability to score margin")
fig.tight_layout(); save(fig, "margin_model")
'''),md('''## 3. Does it express the intended partnership ranking?

Eight synthetic partnership types are repeated 4,000 times at several history
lengths. “Competitive losses” and “Blowout losses” keep the same win outcomes
and probabilities but alter only the losing side's points in losses by three,
preserving the winner and canonicalizing deuce scores to valid first-to-11,
win-by-two finishes. They deliberately test margin
behavior rather than the point model's own assumptions.
'''),code('''scoring=load("scoring")
selected=scoring.query("n == 20 and result_weight == 0.7 and prior == 6").copy()
display(selected[["scenario","raw_win_rate","mean","p05","p95","positive_rate"]])
fig,ax=plt.subplots(figsize=(11,5))
y=np.arange(len(selected))
ax.errorbar(selected["mean"],y,
            xerr=np.vstack([selected["mean"]-selected.p05,selected.p95-selected["mean"]]),
            fmt="o",capsize=4,color="#176b88")
ax.set_yticks(y,selected.scenario)
ax.axvline(0,color="black",lw=1)
ax.set(xlabel="Signed synergy index; mean and 5th–95th history percentiles",
       title="20 games together: overperformance matters more than raw wins")
ax.invert_yaxis();fig.tight_layout();save(fig,"partnership_scenarios")
'''),md('''The overperforming underdog has a positive mean while the expected-dominant
“LeBron” pair remains near zero. Underperforming pairs are negative. Close
losses receive more credit than blowout losses with the same win rate.

The broad intervals matter: even twenty games do not establish a stable order
between all partners. Recency weights mean twenty historical games provide
less information than twenty equally weighted independent games.
'''),code('''ranking=load("ranking")
display(ranking.query("n == 20"))
fig,ax=plt.subplots()
for alpha,df in ranking.groupby("result_weight"):
    ax.plot(df.n,100*df.correct_synergy_rank,marker="o",label=f"{alpha:.0%} results")
raw=ranking.query("result_weight == .7")
ax.plot(raw.n,100*raw.correct_raw_win_rate_rank,"--",color="gray",label="Raw win rate")
ax.set(xlabel="Games with each partner",ylabel="Underdog ranked above favorite (%)",ylim=(0,103),
       title="Correct ranking: 20% → 40% underdog versus 85% → 85% favorite")
ax.legend();save(fig,"ranking_recovery")
'''),md('''## 4. How much should margins count?

Candidate result weights are 0%, 50%, 70%, 90%, and 100%. More margin can help
under the exact generator used to derive expected margin. That advantage alone
is weak evidence: the model was designed to predict those scores.

The result and margin measurements are also strongly correlated. They do not
constitute two independent observations. Score shrinkage uses the number of
games, not the number of component metrics.
'''),code('''print(f"Outcome/margin correlation at equal strength: {manifest['result_margin_correlation']:.3f}")
compare=scoring.query("n == 20 and prior == 6")
display(compare.pivot(index="scenario",columns="result_weight",values="mean"))
'''),md('''## 5. Initial interpretation

- The signed residual approach matches the requested underdog behavior.
- Margins distinguish competitive losses from getting thrashed.
- Under this self-consistent score generator, margins modestly improve ranking
  recovery, but independent score-shape stress tests must constrain the weight.
- Do not adopt a blend solely because it wins this synthetic benchmark.
- Display raw win rate and number of games separately. The signed index itself
  should never be labeled “percentage points above expected wins.”

Continue with **synergy_02_recency_and_robustness.ipynb** for the recency choice,
false-best-partner behavior, rating drift and independent-seed comparisons.
''')]

n2=[md('''# Synergy 2 — recency, confidence, and ways the score can mislead

This notebook uses the same reproducible offline results as Notebook 1. It
compares half-lives 4, 6, 10, 20 and all-history weighting, several shrinkage
strengths, improving/declining partnerships, lucky streaks, multiple-partner
selection, rating errors and score-model errors. The final comparison uses a
separate random seed after the candidate families were specified in code.

**Recommendation to investigate, not ship blindly:** a six-pair-game half-life
is a reasonable product compromise. Use stronger small-sample caution than a
simple games-played count suggests. Keep margin influence modest until its
expected baseline is calibrated to real scoring formats.
'''),code(SETUP),md('''## 1. Translating half-life into the group's sessions

At approximately 1.5 games together per session, a six-game half-life represents
about four sessions. In a long history, the latest six games carry 50% of the
weight, latest twelve 75%, latest eighteen 87.5%. Those shares are exact only
as history tends to infinity; finite histories are normalized over observed
games. This decay counts games with this specific partner, not calendar days.

The effective sample size is finite even with infinite history: geometric
weights imply `(1+lambda)/(1-lambda)`, lambda=`2**(-1/h)`. This is an
independence-based diagnostic, not a guarantee about real uncertainty.
'''),code('''half_lives=[4,6,10,20]
table=pd.DataFrame([{"half_life_games":h,"approx_sessions":h/1.5,
    "long_history_effective_games":(1+2**(-1/h))/(1-2**(-1/h)),
    "effective_games_at_12":evidence(12,h),"effective_games_at_40":evidence(40,h)} for h in half_lives])
display(table)
fig,ax=plt.subplots()
for h in half_lives:
    ages=np.arange(41)
    ax.plot(ages,2.**(-ages/h),label=f"Half-life {h}")
ax.set(xlabel="Pair games ago",ylabel="Weight relative to latest game",title="Gradual fading; no arbitrary last-game cutoff")
ax.legend();save(fig,"recency_weights")
'''),md('''## 2. Improving and declining partnerships

For 30 games the pair's true chance is 50%; then it becomes 70% (improving) or
30% (declining). The rating-based baseline is held at 50% to isolate the
recency tradeoff. Updating ratings is tested later. Every setting is evaluated
on the same histories. All examples below use 70% results and prior 6.

The population target in the table is the **unshrunk current** combined contribution;
shrinkage deliberately biases the displayed estimate toward zero. RMSE to
this target therefore penalizes both stale history and conservative shrinkage.
'''),code('''curves=load("curves")
fig,axs=plt.subplots(1,2,figsize=(12,4.5))
for ax,label in zip(axs,["improving","declining"]):
    for h in ["4","6","10","20","None"]:
        d=curves[(curves.scenario==label)&(curves.half_life==h)]
        ax.plot(d.game,d["mean"],label="All history" if h=="None" else f"Half-life {h}")
    ax.axvline(30,color="black",ls="--",lw=1)
    ax.axhline(0,color="gray",lw=.7)
    ax.set(title=label.capitalize(),xlabel="Games together",ylabel="Mean signed index")
axs[0].legend(fontsize=9);fig.tight_layout();save(fig,"changing_partnerships")
fig,ax=plt.subplots()
for h in ["4","6","10","20","None"]:
    d=curves[(curves.scenario=="improving")&(curves.half_life==h)]
    ax.plot(d.game,d.raw_mean,label="All history" if h=="None" else f"Half-life {h}")
ax.axvline(30,color="black",ls="--",lw=1)
ax.set(xlabel="Games together",ylabel="Unshrunk mean index",title="Recency alone, without the effective-sample shrinkage penalty")
ax.legend();save(fig,"recency_without_shrinkage")
recency=load("recency")
display(recency[(recency.n==40)][["scenario","half_life","target","mean","sd","rmse"]])
'''),md('''Shorter half-lives respond faster; longer half-lives are steadier when nothing
has changed. Their evidence-based shrinkage also differs: shorter half-lives
have lower effective sample size, so they plateau closer to zero even after
they have adapted. Compare the unshrunk curves below to isolate fading from
that deliberate confidence penalty. No single half-life dominates both objectives. A six-game
half-life is a middle-ground product choice, not a statistically unique winner.

The shaded band below is the 5th–95th percentile spread of individual histories,
showing how much less certain any one real pair would be than the mean curve.
'''),code('''fig,ax=plt.subplots()
for label,color in [("improving","#176b88"),("stationary","#777777")]:
    d=curves[(curves.scenario==label)&(curves.half_life=="6")]
    ax.plot(d.game,d["mean"],label=label,color=color)
    ax.fill_between(d.game,d.p05,d.p95,color=color,alpha=.15)
ax.axvline(30,color="black",ls="--",lw=1)
ax.set(xlabel="Games together",ylabel="Signed index",title="Six-game half-life: history-to-history noise remains substantial")
ax.legend();save(fig,"recency_uncertainty")
fig,ax=plt.subplots()
for h in ["4","6","10","20","None"]:
    d=curves[(curves.scenario=="lucky streak then ordinary")&(curves.half_life==h)]
    ax.plot(d.game,d["mean"],label="All history" if h=="None" else f"Half-life {h}")
ax.set(xlabel="Games together (first 4 were 11–5 wins)",ylabel="Mean signed index",title="Does an early lucky streak stop dominating?")
ax.legend();save(fig,"lucky_streak")
'''),md('''## 3. The strongest-looking partner can simply be lucky

All partners below have exactly zero chemistry and 50% expected/actual win
probability. We select the highest-scoring partner out of 1, 8 or 16 candidates.
A positive “best” score is therefore a selection artifact by construction.

This is not the false-positive rate of a calibrated statistical test: +15 is
an illustrative UI score threshold, not a declared significance level. Rank
selection alone always picks somebody, even when no partnership is special.
'''),code('''selection=load("selection")
display(selection.query("n == 12 and partners == 16")[["prior","mean","p95","above15","above25"]])
fig,ax=plt.subplots()
for prior in [0,6,12]:
    d=selection.query("partners == 16 and prior == @prior")
    ax.plot(d.n,100*d.above15,marker="o",label=f"Prior {prior}")
ax.set(xlabel="Games with each of 16 neutral partners",ylabel="Best neutral partner exceeds +15 (%)",
       title="Shrinkage reduces flattering scores; it does not prove chemistry")
ax.legend();save(fig,"false_best_partner")
'''),md('''Prior 12 is worth testing as a more cautious default than prior 6. The tradeoff
is smaller displayed scores for genuine improvement too. A long history does
not remove all noise when old games are continually discounted.

Avoid hard claims such as “proven best partner.” Consider “strongest observed
partnership” plus an explicit provisional label, separate games and win-rate
context, and uncertainty validated under realistic repeated-session data.
A minimum-games gate helps presentation but cannot alone fix selection bias.
'''),md('''## 4. Rating accuracy and persistent chemistry

A result residual estimates `true chance - predicted chance`. It cannot know
whether the gap came from chemistry or an underestimated player. Baseline
errors of ±15 probability points are tested with zero true chemistry.

A separate stress case gives a pair a persistent 70% true chance against a
fixed-rating opponent. Both teammates' ratings receive the app's 40/20 Elo
updates while the opponent rating is held fixed. This intentionally extreme
fixed-pair schedule is not a rotating league: it isolates how individual Elo
can absorb a partnership effect. Frozen and online baselines use the same
outcomes within each half-life comparison.
'''),code('''robust=load("robustness")
display(robust[robust.experiment=="rating calibration"])
d=robust[robust.experiment=="rating absorbs chemistry"].copy()
display(d)
d=d[d.condition.str.contains("h=6;")].copy()
fig,ax=plt.subplots()
for mode in ["frozen baseline","online Elo"]:
    z=d[d.condition.str.startswith(mode)].copy()
    games=z.condition.str.extract(r"n=([0-9]+)")[0].astype(int)
    ax.plot(games,z["mean"],marker="o",label=mode)
ax.set(xlabel="Games played together",ylabel="Mean signed index",
       title="Persistent advantage can disappear into individual ratings")
ax.legend();save(fig,"elo_absorption")
'''),md('''This is the biggest semantic limitation. The proposed score measures **recent
performance beyond the current rating baseline**, not an immutable or causal
partnership trait. A permanently good pair may return toward zero once Elo
expects them to keep winning. Fixing that requires a different baseline or a
joint player-and-partnership model, not merely a different half-life.

The same +100 Elo latent partnership boost also produces different probability
residuals for different opponent strengths. That is consistent with “beating
the odds by percentage points,” but not a schedule-independent chemistry unit.
'''),code('''display(robust[robust.experiment=="same +100 Elo chemistry"])
'''),md('''## 5. Margin-model failures and correlated sessions

First preserve every winner but make all games systematically closer or wider.
A margin model trained on the original scoring style will assign nonzero
chemistry even when win probabilities are perfectly calibrated. The candidate
blend is also tested on games to 15 using an expected-margin mapping for 11.

Then add a shared session-form shock, with 1–4 games per session and mean block
size 1.5. Shocks are symmetric on log odds, retaining a 50% marginal win chance.
The spread of scores grows: treating all pair games as independent is optimistic.
'''),code('''display(robust[robust.experiment=="margin misspecification"])
display(load("targets"))
display(load("sessions"))
'''),md('''70/30 has a larger sensitivity to an incorrect margin baseline than 90/10.
That does not establish 90/10 as optimal; it supports a cautious margin weight
until expected margins can be fitted and checked by scoring format. Do not
label the resulting heuristic score as a posterior probability or claim an
uncertainty interval without calibration.
'''),md('''## 6. Independent-seed follow-up

The following run uses seed 20261016, separate from the exploratory histories.
It repeats the underdog-versus-favorite ranking and neutral-best selection on
predeclared 4/6/10 half-lives, 70/90/100% result weights and priors 6/12.
This is an independent Monte Carlo stream, **not validation on real players or
an unseen scoring model**. Candidate families were specified in code; these
synthetic comparisons are not a pre-registered real-world study.
'''),code('''holdout=load("holdout")
display(holdout)
chosen=holdout.query("half_life == 6 and result_weight == .9 and prior == 12").iloc[0]
print(f"Cautious candidate: correct underdog ranking {chosen.correct_rank:.1%}; "
      f"neutral best > +15 in {chosen.null_best_above15:.1%} of histories.")
print("Monte Carlo standard error for a fraction with 4,000 repeats is at most ~0.8 percentage points.")
'''),md('''## 7. Decision and what to do next

1. Keep the shared signed residual concept. It passes the desired underdog
   examples and invariants, including team reversal and zero-centered nulls.
2. Start product exploration with a **six-game half-life**. It represents about
   four sessions together and has a long-history effective sample size of only
   about seventeen independent games. Compare 4 and 10 if faster response or
   stability matters more; neither is universally correct.
3. Treat **90% results / 10% calibrated margin, prior 12** as a cautious next
   candidate, alongside the original 70/30/prior-6 benchmark. More margin helps
   slightly in the self-consistent generator, but is vulnerable to score-model
   error. These weights are not a final production recommendation.
4. Show win rate, games together and provisional evidence separately. Never
   interpret index points as win-probability percentage points.
5. Decide whether persistent partnership ability should remain positive after
   individual ratings learn it. Current residuals cannot promise that behavior.
6. Before implementation, use a separate synthetic rotating-player league with
   actual rating updates, then chronological validation on explicitly approved
   non-production match data. Fit margins separately by scoring format, assess
   opponent effects and group differences, and validate uncertainty before
   labeling any partner confidently strongest.

**Limits:** no real-user data, no app matchmaking integration, no serving-aware
point engine, no inferred causal chemistry, no calibrated confidence intervals,
and no production scoring changes. Pair histories are deliberately controlled
experiments rather than a full league simulation. The six-game choice is a
product compromise supported by tradeoffs, not proof of optimality.
''')]


def export_html(nb, path):
    parts=['<!doctype html><meta charset="utf-8"><title>'+html.escape(path.stem)+'</title>',
           '<style>body{font:16px/1.6 system-ui;margin:40px auto;max-width:1120px;padding:0 24px;color:#17212c}pre{background:#f4f6f8;padding:16px;overflow:auto}table{border-collapse:collapse;font-size:13px}td,th{border:1px solid #ddd;padding:7px;text-align:right}img{max-width:100%}.markdown{margin:28px 0}h1,h2,h3{line-height:1.25}code{background:#f4f6f8;padding:2px 4px}details{margin:12px 0}</style>']
    # Render notebook prose and keep executed tables and figures self-contained.
    for cell in nb.cells:
        if cell.cell_type=='markdown':
            parts.append('<div class="markdown">'+markdown.markdown(cell.source, extensions=['tables', 'fenced_code'])+'</div>')
        else:
            parts.append('<details><summary>Python source</summary><pre>'+html.escape(cell.source)+'</pre></details>')
            for out in cell.get('outputs',[]):
                data=out.get('data',{})
                if 'image/png' in data:parts.append('<img alt="Simulation figure" src="data:image/png;base64,'+data['image/png']+'">')
                elif 'text/html' in data:parts.append(data['text/html'])
                elif 'text/plain' in data:parts.append('<pre>'+html.escape(data['text/plain'])+'</pre>')
                elif 'text' in out:parts.append('<pre>'+html.escape(out['text'])+'</pre>')
    path.write_text('\n'.join(parts))


def main():
    # The spec is temporary and points to this environment; portable notebook
    # metadata remains the conventional python3 name.
    with tempfile.TemporaryDirectory(prefix='synergy-jupyter-') as td:
        spec=Path(td)/'kernels'/'python3';spec.mkdir(parents=True)
        (spec/'kernel.json').write_text(json.dumps({'argv':[sys.executable,'-m','ipykernel_launcher','-f','{connection_file}'],'display_name':'Python 3','language':'python'}))
        os.environ['JUPYTER_PATH']=td+os.pathsep+os.environ.get('JUPYTER_PATH','')
        for name,cells in [('synergy_01_scoring',n1),('synergy_02_recency_and_robustness',n2)]:
            nb=nbf.v4.new_notebook(cells=cells,metadata={'kernelspec':{'name':'python3','display_name':'Python 3','language':'python'}})
            NotebookClient(nb,timeout=180,kernel_name='python3',resources={'metadata':{'path':str(ROOT)}}).execute()
            nbf.validate(nb)
            assert not any(o.get('output_type')=='error' for c in nb.cells for o in c.get('outputs',[]))
            nbf.write(nb,ROOT/f'{name}.ipynb')
            export_html(nb,ROOT/f'{name}.html')
            print(f'Executed, validated and exported {name}',flush=True)

if __name__=='__main__':main()
