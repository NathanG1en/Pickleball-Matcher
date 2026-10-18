"""Offline synthetic partnership experiments; never connects to an app or database.

Run with Python 3.12+ and analysis/requirements-synergy.txt. Notebook builder is
build_synergy_notebooks.py. All random streams are reproducible from SEED.
"""
from __future__ import annotations

from dataclasses import dataclass
from math import comb
from pathlib import Path
import json
import hashlib
from importlib.metadata import version
import platform
import sys

import numpy as np
import pandas as pd
from scipy.special import expit, logit

SEED = 20261015
REPS = 4000
OUTPUT = Path(__file__).resolve().parent / "synergy_results"


@dataclass
class ScoreModel:
    """Hypothesis: iid awarded points, race to target, win by two.

    This is NOT a validated side-out pickleball scoring model. It supplies a
    coherent, falsifiable bridge from game probability to score distribution.
    """
    target: int = 11

    def __post_init__(self):
        t = self.target
        self.q = np.linspace(.02, .98, 4001)
        q, r = self.q[:, None], 1 - self.q[:, None]
        k = np.arange(t - 1)
        first = np.array([comb(t - 1 + int(i), int(i)) for i in k]) * q**t * r**k
        opposite = np.array([comb(t - 1 + int(i), int(i)) for i in k]) * r**t * q**k
        reach = comb(2*t - 2, t - 1) * q**(t-1) * r**(t-1)
        j = np.arange(45)
        deuce_a = reach * (2*q*r)**j * q*q
        deuce_b = reach * (2*q*r)**j * r*r
        self.a = np.r_[np.full(t-1, t), k, t+1+j, t-1+j]
        self.b = np.r_[k, np.full(t-1, t), t-1+j, t+1+j]
        prob = np.concatenate([first, opposite, deuce_a, deuce_b], axis=1)
        assert np.max(np.abs(prob.sum(axis=1) - 1)) < 1e-12
        self.prob = prob / prob.sum(axis=1, keepdims=True)
        self.cdf = self.prob.cumsum(axis=1)
        self.cdf[:, -1] = 1
        self.margin = (self.a-self.b)/(self.a+self.b)
        self.p = self.prob @ (self.a > self.b)
        self.mu = self.prob @ self.margin
        i = np.argmin(abs(self.p-.5))
        # Match equal-strength per-game standard deviations, not arbitrary units.
        self.margin_scale = .5 / np.sqrt(self.prob[i] @ (self.margin-self.mu[i])**2)
        self.draws = 0

    def expected_margin(self, p):
        return np.interp(p, self.p, self.mu)

    def sample(self, rng, probabilities):
        p = np.asarray(probabilities, float)
        flat = p.ravel()
        # Nearest grid row: records actual generating probability for diagnostics.
        idx = np.clip(np.searchsorted(self.p, flat), 1, len(self.p)-1)
        idx -= (abs(self.p[idx-1]-flat) < abs(self.p[idx]-flat))
        u = rng.random(flat.size)
        states = np.empty(flat.size, dtype=int)
        for start in range(0, flat.size, 8192):
            sl = slice(start, start+8192)
            states[sl] = (u[sl, None] > self.cdf[idx[sl]]).sum(axis=1)
        self.draws += flat.size
        return self.a[states].reshape(p.shape), self.b[states].reshape(p.shape)


def weights(n, half_life=6):
    return np.ones(n) if half_life is None else np.exp2(-np.arange(n-1, -1, -1)/half_life)


def evidence(n, half_life=6):
    w = weights(n, half_life)
    return w.sum()**2/(w@w)


def contributions(a, b, expected, model, result_weight=.7):
    win = (a>b).astype(float)
    residual = win-np.asarray(expected)
    margin = (a-b)/(a+b)
    adjusted_margin = model.margin_scale*(margin-model.expected_margin(expected))
    return result_weight*residual + (1-result_weight)*adjusted_margin


def estimate(x, half_life=6, prior=6):
    """Signed index; confidence shrinkage is a heuristic, not Bayesian posterior."""
    n = x.shape[-1]
    w = weights(n, half_life)
    neff = evidence(n, half_life)
    return 100 * np.sum(x*w, axis=-1)/w.sum() * neff/(neff+prior)


def summary(values):
    return dict(mean=float(np.mean(values)), sd=float(np.std(values)),
                p05=float(np.quantile(values,.05)), p95=float(np.quantile(values,.95)))


def adjust_scores(a, b, delta, only_losses=False, target=11):
    """Change losing points, preserve winners, canonicalize legal terminal scores."""
    mask=(a<b) if only_losses else np.ones(a.shape,dtype=bool)
    winner,loser=np.maximum(a,b),np.minimum(a,b)
    adjusted=np.clip(loser+delta,0,winner-2)
    finish=np.where(adjusted<target-1,target,adjusted+2)
    aa=np.where(mask,np.where(a>b,finish,adjusted),a)
    bb=np.where(mask,np.where(b>a,finish,adjusted),b)
    assert np.all((aa>bb)==(a>b))
    high,low=np.maximum(aa,bb),np.minimum(aa,bb)
    assert np.all(((high==target)&(low<=target-2))|((high>=target+1)&(high-low==2)))
    return aa,bb


def run_scoring(model, rng):
    rows, ranking = [], []
    scenarios = [
        ("LeBron: expected dominance", .85, .85, "ordinary"),
        ("Underdogs: 20% to 40%", .20, .40, "ordinary"),
        ("Balanced: 50% to 60%", .50, .60, "ordinary"),
        ("Balanced: no chemistry", .50, .50, "ordinary"),
        ("Underperforming: 60% to 40%", .60, .40, "ordinary"),
        ("Underdogs: as expected", .20, .20, "ordinary"),
        ("Competitive losses", .20, .20, "close_losses"),
        ("Blowout losses", .20, .20, "blowout_losses"),
    ]
    cached={}
    for name,p,true,style in scenarios:
        if true not in cached:
            cached[true]=model.sample(rng,np.full((REPS,80),true))
        a,b=cached[true]
        if style == "close_losses":
            a,b=adjust_scores(a,b,3,only_losses=True)
        if style == "blowout_losses":
            a,b=adjust_scores(a,b,-3,only_losses=True)
        for n in [2,4,8,12,20,40,80]:
            aa,bb=a[:,:n],b[:,:n]
            for alpha in [0,.5,.7,.9,1]:
                x=contributions(aa,bb,p,model,alpha)
                for prior in [0,6,12]:
                    s=estimate(x,6,prior)
                    rows.append(dict(scenario=name,n=n,result_weight=alpha,prior=prior,
                        raw_win_rate=float(np.mean(aa>bb)),positive_rate=float(np.mean(s>0)),
                        high_score_rate=float(np.mean(s>15)),**summary(s)))
    # Same independent repeats, identical observations reused across candidates.
    a1,b1=model.sample(rng,np.full((REPS,80),.4))
    a2,b2=model.sample(rng,np.full((REPS,80),.85))
    for n in [4,8,12,20,40,80]:
        for alpha in [.5,.7,.9,1]:
            s1=estimate(contributions(a1[:,:n],b1[:,:n],.2,model,alpha))
            s2=estimate(contributions(a2[:,:n],b2[:,:n],.85,model,alpha))
            ranking.append(dict(n=n,result_weight=alpha,
                correct_synergy_rank=float(np.mean(s1>s2)),
                correct_raw_win_rate_rank=float(np.mean((a1[:,:n]>b1[:,:n]).mean(1)>(a2[:,:n]>b2[:,:n]).mean(1)))))
    # Result-margin correlation documents double counting, not independent signals.
    aa,bb=model.sample(rng,np.full(100_000,.5))
    corr=float(np.corrcoef((aa>bb).astype(float),(aa-bb)/(aa+bb))[0,1])
    return pd.DataFrame(rows),pd.DataFrame(ranking),corr


def run_recency(model,rng):
    rows,curves=[],[]
    true=np.r_[np.full(30,.5),np.full(30,.7)]
    for label,ps in [("improving",true),("declining",1-true),("stationary",np.full(60,.5))]:
        a,b=model.sample(rng,np.broadcast_to(ps,(REPS,60)))
        x=contributions(a,b,.5,model)
        for h in [4,6,10,20,None]:
            for t in range(1,61):
                s=estimate(x[:,:t],h,6)
                curves.append(dict(scenario=label,half_life=str(h),game=t,
                    raw_mean=float(estimate(x[:,:t],h,0).mean()),**summary(s)))
            for n in [6,12,20,40,60]:
                s=estimate(x[:,:n],h,6)
                # Population CURRENT target, not hindsight fit to noisy histories.
                target=100*(.7*(ps[n-1]-.5)+.3*model.margin_scale*(model.expected_margin(ps[n-1])-model.expected_margin(.5)))
                rows.append(dict(scenario=label,half_life=str(h),n=n,neff=evidence(n,h),
                    target=target,rmse=float(np.sqrt(np.mean((s-target)**2))),**summary(s)))
    # A four-game perfect streak followed by ordinary performance.
    a,b=model.sample(rng,np.full((REPS,40),.5))
    a[:,:4],b[:,:4]=11,5
    for h in [4,6,10,20,None]:
        x=contributions(a,b,.5,model)
        for t in range(4,41):
            s=estimate(x[:,:t],h,6)
            curves.append(dict(scenario="lucky streak then ordinary",half_life=str(h),game=t,
                raw_mean=float(estimate(x[:,:t],h,0).mean()),**summary(s)))
    return pd.DataFrame(rows),pd.DataFrame(curves)


def run_robustness(model,rng):
    rows=[]
    # Incorrect rating baselines masquerade as chemistry, regardless of sample size.
    for true in [.2,.5,.8]:
        a,b=model.sample(rng,np.full((REPS,40),true))
        for error in [-.15,0,.15]:
            p=np.clip(true+error,.02,.98)
            s=estimate(contributions(a,b,p,model))
            rows.append(dict(experiment="rating calibration",condition=f"true={true}, predicted={p:.2f}",**summary(s)))
    # Equal latent Elo chemistry has a smaller probability effect at the extremes.
    for baseline in [.1,.2,.5,.8,.9]:
        true=expit(logit(baseline)+np.log(10)*100/400)
        a,b=model.sample(rng,np.full((REPS,40),true))
        s=estimate(contributions(a,b,baseline,model))
        rows.append(dict(experiment="same +100 Elo chemistry",condition=f"baseline={baseline}",**summary(s)))
    # Same winners, different legal score shapes: stress unvalidated margin mapping.
    a,b=model.sample(rng,np.full((REPS,40),.2))
    for label,delta in [("ordinary scores",0),("closer scores",3),("wider scores",-3)]:
        aa,bb=adjust_scores(a,b,delta)
        for alpha in [.5,.7,.9,1]:
            s=estimate(contributions(aa,bb,.2,model,alpha))
            rows.append(dict(experiment="margin misspecification",condition=f"{label}; result weight={alpha}",**summary(s)))
    # Ratings learn individual strength from pair games. Here *only this pair*
    # plays repeatedly, an intentional worst case for absorption of chemistry.
    for h in [6,10,None]:
        a,b=model.sample(rng,np.full((REPS,80),.7))
        rating=np.zeros(REPS)
        prediction=np.zeros((REPS,80))
        for t in range(80):
            p=1/(1+10**(-rating/400));prediction[:,t]=p
            rating += (40 if t<10 else 20)*((a[:,t]>b[:,t])-p)
        for n in [12,40,80]:
            for mode,pred in [("frozen baseline",.5),("online Elo",prediction[:,:n])]:
                s=estimate(contributions(a[:,:n],b[:,:n],pred,model),h)
                rows.append(dict(experiment="rating absorbs chemistry",condition=f"{mode}; h={h}; n={n}",**summary(s)))
    return pd.DataFrame(rows)


def run_selection(model,rng):
    rows=[]
    for n in [4,8,12,30]:
        a,b=model.sample(rng,np.full((REPS,16,n),.5))
        x=contributions(a,b,.5,model)
        for prior in [0,6,12]:
            s=estimate(x,6,prior)
            for count in [1,8,16]:
                best=s[:,:count].max(1)
                rows.append(dict(n=n,partners=count,prior=prior,
                    above15=float(np.mean(best>15)),above25=float(np.mean(best>25)),**summary(best)))
    return pd.DataFrame(rows)


def run_session_correlation(model,rng):
    rows=[]
    # Match blocks of 1..4 with expected size 1.5, per user context.
    # Shared session logit shock; intercept adjusted to retain marginal p=.5.
    for sd in [0,.65,1.2]:
        a=np.zeros((REPS,40),int);b=a.copy()
        for rep in range(REPS):
            pos=0
            while pos<40:
                length=min(int(rng.choice([1,2,3,4],p=[.65,.25,.05,.05])),40-pos)
                # Symmetry means logistic-normal has exact marginal mean .5.
                p=float(expit(rng.normal(0,sd)))
                aa,bb=model.sample(rng,np.full(length,p))
                a[rep,pos:pos+length]=aa;b[rep,pos:pos+length]=bb;pos+=length
        x=contributions(a,b,.5,model)
        for h in [4,6,10]:
            s=estimate(x,h,6)
            rows.append(dict(session_logit_sd=sd,half_life=h,**summary(s)))
    return pd.DataFrame(rows)


def run_holdout(model):
    """Independent predeclared random stream; repeat selected comparisons only."""
    rng=np.random.default_rng(SEED+1)
    rows=[]
    a1,b1=model.sample(rng,np.full((REPS,20),.4))
    a2,b2=model.sample(rng,np.full((REPS,20),.85))
    an,bn=model.sample(rng,np.full((REPS,16,12),.5))
    for h in [4,6,10]:
        for alpha in [.7,.9,1]:
            for prior in [6,12]:
                s1=estimate(contributions(a1,b1,.2,model,alpha),h,prior)
                s2=estimate(contributions(a2,b2,.85,model,alpha),h,prior)
                null=estimate(contributions(an,bn,.5,model,alpha),h,prior).max(1)
                rows.append(dict(half_life=h,result_weight=alpha,prior=prior,
                    correct_rank=float(np.mean(s1>s2)),underdog_mean=float(s1.mean()),
                    null_best_p95=float(np.quantile(null,.95)),
                    null_best_above15=float(np.mean(null>15))))
    # Session shock shared by *both* partners: same identity/order => same value.
    return pd.DataFrame(rows)


def checks(model):
    assert abs(model.expected_margin(.5))<1e-10
    assert np.allclose(model.expected_margin(np.array([.2,.8])), -model.expected_margin(np.array([.8,.2])))
    assert np.allclose(model.prob.sum(1),1)
    assert np.max(np.abs(np.diff(model.p)))<.002
    # Reversing team order reverses the score; switching partners has no effect.
    a,b=np.array([[11,9,11]]),np.array([[7,11,3]])
    p=np.array([[.6,.4,.8]])
    x=contributions(a,b,p,model)
    y=contributions(b,a,1-p,model)
    assert np.allclose(x,-y,atol=1e-12)
    assert estimate(np.zeros((1,20)))[0]==0
    assert evidence(2000,6)<18
    return {"probability_mass":True,"neutral_center":True,"team_reversal_symmetry":True,
        "neutral_history_score":True,"finite_recency_information":True}


def run_all():
    OUTPUT.mkdir(exist_ok=True)
    model=ScoreModel();rng=np.random.default_rng(SEED)
    verified=checks(model)
    scoring,ranking,corr=run_scoring(model,rng)
    recency,curves=run_recency(model,rng)
    robust=run_robustness(model,rng)
    selection=run_selection(model,rng)
    sessions=run_session_correlation(model,rng)
    holdout=run_holdout(model)
    # Independent score-target stress: model built for 15 rather than 11 points.
    m15=ScoreModel(15)
    target_rows=[]
    for p in [.2,.5,.8]:
        a,b=m15.sample(rng,np.full((REPS,40),p))
        for label,mu in [("use 11-point margin baseline",model.expected_margin(p)),("correct 15-point margin baseline",m15.expected_margin(p))]:
            x=.7*((a>b)-p)+.3*model.margin_scale*((a-b)/(a+b)-mu)
            target_rows.append(dict(probability=p,baseline=label,**summary(estimate(x))))
    tables=dict(scoring=scoring,ranking=ranking,recency=recency,curves=curves,
                robustness=robust,selection=selection,sessions=sessions,holdout=holdout,targets=pd.DataFrame(target_rows))
    for name,df in tables.items():df.to_csv(OUTPUT/f"{name}.csv",index=False)
    manifest=dict(seed=SEED,holdout_seed=SEED+1,repetitions=REPS,synthetic_matches=model.draws+m15.draws,
        result_margin_correlation=corr,margin_scale=model.margin_scale,
        grid_max_probability_step=float(np.max(np.diff(model.p))),checks=verified,
        python=sys.version,platform=platform.platform(),numpy=np.__version__,pandas=pd.__version__,
        simulation_source_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        packages={name:version(name) for name in ["numpy","pandas","scipy","matplotlib","nbformat","nbclient","ipykernel","Markdown"]})
    (OUTPUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
    print(json.dumps(manifest,indent=2))
    return tables,manifest


if __name__=='__main__':run_all()
