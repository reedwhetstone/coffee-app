"""Farm-quality persistence in Cup of Excellence results.

Reads coe_lots.csv (built by parse_coe.py), resolves farm entities, and writes:
  coe_entities.csv        lot rows with resolved entity ids (three resolution rules)
  results_tables/*.csv    tables behind results.md
  analysis_output.txt     every number quoted in results.md
Run: uv run --with pandas --with numpy --with scipy --with statsmodels python analyze.py
"""
import difflib
import os
import re
import sys
import unicodedata
from collections import defaultdict

import numpy as np
import pandas as pd
import statsmodels.formula.api as smf
from scipy import stats

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "results_tables")
os.makedirs(OUT, exist_ok=True)
RNG = np.random.default_rng(20261002)
N_PERM = 2000
log_f = open(os.path.join(HERE, "analysis_output.txt"), "w", buffering=1)


def say(*a):
    msg = " ".join(str(x) for x in a)
    print(msg, flush=True)
    log_f.write(msg + "\n")


# ---------------------------------------------------------------- name normalisation
def fold(s):
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


FARM_PREFIX = r"^(finca|fca|hacienda|granja|sitio|fazenda|faz|chacara|estate|beneficio|micro ?beneficio|quinta|rancho|cafetal|the|el|la|los|las|de|del|do|da|dos|das)\s+"
FARM_SUFFIX = r"\s+(lote?\s*\w+|lot\s*\w+|i{1,3}|iv|v|vi|[0-9]+|[a-d])$"


def farm_core(name):
    s = re.sub(r"\(.*?\)", " ", str(name or ""))
    s = re.split(r"\s[–-]\s", s)[0]
    s = fold(s)
    s = re.sub(r"\b(19|20)\d\d\b", " ", s).strip()
    for _ in range(4):
        s2 = re.sub(FARM_PREFIX, "", s).strip()
        s2 = re.sub(FARM_SUFFIX, "", s2).strip()
        if s2 == s or not s2:
            break
        s = s2
    return re.sub(r"\s+", " ", s)


FARMER_STOP = set(
    """de del la las los y e da do dos das sa s a c v cv rl ltda ltd inc eireli me sociedad anonima capital variable
    cooperativa coop soc cia compania agricola agropecuaria inversiones finca hacienda fazenda sitio w nan not known
    and the cafe coffee cafes estate group grupo company empresa familia family hijos sucesores agro asociacion
    representative productores""".split()
)


def farmer_tokens(name):
    if not isinstance(name, str) or not name.strip() or name.strip() in {"–", "-"}:
        return frozenset()
    return frozenset(t for t in fold(name).split() if len(t) >= 4 and t not in FARMER_STOP)


class DSU:
    def __init__(self, n):
        self.p = list(range(n))

    def find(self, x):
        while self.p[x] != x:
            self.p[x] = self.p[self.p[x]]
            x = self.p[x]
        return x

    def union(self, a, b):
        a, b = self.find(a), self.find(b)
        if a != b:
            self.p[b] = a


def resolve(df, rule):
    """Return entity id per row. rule in {'standard', 'strict', 'name_only'}.

    name_only: same country + same normalised farm name (upper bound; merges unrelated homonym farms).
    standard : same normalised farm name AND (>=2 shared farmer/owner tokens, both owners the same single token, or
               1 shared token that is rare in the country's farmer names or accompanied by an overlapping region token); lots with no farmer listed attach to a
               farm name only when exactly one entity with that name exists in the country. Also links the same
               farmer (>=2 shared tokens) across near-identical farm names (similarity >= 0.85).
    strict   : same normalised farm name AND (>=2 shared farmer tokens, or both owners are the same single token);
               no-farmer lots stay unlinked.
    A single shared token never links on its own: 'Martinez' vs 'Juan Martinez' at two unrelated 'La Esperanza' farms
    stays split unless the token is rare in the country or the regions overlap (standard only). Both owners listed as
    exactly 'Martinez' link under both rules, so strict stays a subset of standard.
    """
    ids = pd.Series(index=df.index, dtype=object)
    for country, g in df.groupby("country"):
        idx = list(g.index)
        if rule == "name_only":
            for i in idx:
                ids[i] = f"{country}|{g.at[i, 'farm_core']}"
            continue
        dsu = DSU(len(idx))
        pos = {i: k for k, i in enumerate(idx)}
        by_core = defaultdict(list)
        for i in idx:
            by_core[g.at[i, "farm_core"]].append(i)
        # token frequency among this country's farmer names: a single shared *common* surname (Silva, Martinez...)
        # is not enough to link two same-named farms unless their regions also overlap
        tok_freq = defaultdict(int)
        for i in idx:
            for t in g.at[i, "ftok"]:
                tok_freq[t] += 1
        rare_cut = max(3, 0.01 * len(idx))
        for core, members in by_core.items():
            if not core:
                continue
            with_f = [i for i in members if g.at[i, "ftok"]]
            for a_i, a in enumerate(with_f):
                ta = g.at[a, "ftok"]
                for b in with_f[a_i + 1:]:
                    tb = g.at[b, "ftok"]
                    shared = ta & tb
                    if rule == "strict":
                        link = len(shared) >= 2 or (len(ta) == 1 and ta == tb)
                    else:
                        link = len(shared) >= 2 or (len(ta) == 1 and ta == tb) or (len(shared) == 1 and (
                            tok_freq[next(iter(shared))] <= rare_cut or bool(g.at[a, "rtok"] & g.at[b, "rtok"])))
                    if link:
                        dsu.union(pos[a], pos[b])
        if rule == "standard":
            # same farmer, near-identical farm name spelling (e.g. 'Montañita' vs 'Montanita Pacamara')
            cores = list(by_core)
            for a_k, ca in enumerate(cores):
                for cb in cores[a_k + 1:]:
                    if not ca or not cb:
                        continue
                    if not (ca.startswith(cb) or cb.startswith(ca) or difflib.SequenceMatcher(None, ca, cb).ratio() >= 0.85):
                        continue
                    for a in by_core[ca]:
                        for b in by_core[cb]:
                            if len(g.at[a, "ftok"] & g.at[b, "ftok"]) >= 2:
                                dsu.union(pos[a], pos[b])
            # lots with no farmer listed (2020 online competitions publish only auction tables)
            for core, members in by_core.items():
                roots = {dsu.find(pos[i]) for i in members if g.at[i, "ftok"]}
                orphans = [i for i in members if not g.at[i, "ftok"]]
                if not orphans:
                    continue
                if len(roots) == 1:
                    r = next(iter(roots))
                    for i in orphans:
                        dsu.union(r, pos[i])
                elif len(roots) == 0:
                    for i in orphans[1:]:
                        dsu.union(pos[orphans[0]], pos[i])
        for i in idx:
            ids[i] = f"{country}|{rule}|{dsu.find(pos[i])}"
    return ids


# ---------------------------------------------------------------- load
lots = pd.read_csv(os.path.join(HERE, "coe_lots.csv"))
lots["farm_core"] = lots["farm"].map(farm_core)
lots["ftok"] = lots["farmer"].map(farmer_tokens)
REGION_STOP = {"minas", "gerais", "norte", "south", "north", "departamento", "municipio", "region", "sul", "zona", "alta", "baja"}
lots["rtok"] = lots["region"].map(lambda r: frozenset(t for t in fold(r).split() if len(t) >= 4 and t not in REGION_STOP) if isinstance(r, str) else frozenset())
lots["geisha"] = lots["variety"].fillna("").str.contains(r"ge?i?sha", case=False, regex=True).astype(int)
lots["variety_known"] = lots["variety"].notna().astype(int)
lots["weight_num"] = pd.to_numeric(lots["weight"].astype(str).str.replace(",", "").str.extract(r"(\d+\.?\d*)")[0], errors="coerce")

# split lots (1a/1b of the same coffee) -> one placement; keep the lot rows for price analysis
for rule in ["standard", "strict", "name_only"]:
    lots[f"ent_{rule}"] = resolve(lots, rule)
lots.drop(columns=["ftok", "rtok"]).to_csv(os.path.join(HERE, "coe_entities.csv"), index=False)

say("# CoE farm persistence analysis output\n")
say("Lots parsed:", len(lots), "| CoE tier:", (lots.tier == "CoE").sum(), "| National Winner tier:", (lots.tier == "NW").sum())
cov = lots[lots.tier == "CoE"].groupby("country").agg(
    first_year=("year", "min"), last_year=("year", "max"), competition_years=("year", "nunique"),
    competitions=("slug", "nunique"), lots=("farm", "size"),
    with_score=("score_num", lambda s: s.notna().sum()), with_price=("price_usd_lb", lambda s: s.notna().sum()),
    with_buyer=("buyer", lambda s: s.notna().sum()),
)
say("\n## Coverage (CoE tier)\n" + cov.to_string())
cov.to_csv(os.path.join(OUT, "coverage.csv"))


def placements(df, ent_col):
    """Entity-year table: one row per entity per calendar year (best-scoring lot)."""
    d = df.copy()
    comp = d.groupby("slug")["score_num"]
    d["comp_mean"] = comp.transform("mean")
    d["score_dm"] = d["score_num"] - d["comp_mean"]
    # percentile within competition by score (1 = best). Ties averaged.
    d["pct"] = comp.rank(pct=True, method="average")
    d["n_comp"] = d.groupby("slug")["farm"].transform("size")
    d["pos"] = comp.rank(ascending=False, method="min")
    d = d.sort_values(["score_num"], ascending=False, na_position="last")
    py = d.groupby([ent_col, "country", "year"], as_index=False).first()
    py = py.rename(columns={ent_col: "ent"})
    return py


def country_years(df):
    return df.groupby("country")["year"].apply(lambda s: sorted(set(s))).to_dict()


# ---------------------------------------------------------------- 1. repeat appearance
def repeat_table(py, cy, label):
    rows = []
    py = py.sort_values("year")
    for country, g in py.groupby("country"):
        last = max(cy[country])
        yrs_by_ent = g.groupby("ent")["year"].apply(lambda s: sorted(set(s))).to_dict()
        firsts = {e: y[0] for e, y in yrs_by_ent.items()}
        for k in [1, 2, 3, 5]:
            # first observed appearance cohort
            elig = [e for e, y0 in firsts.items() if y0 + k <= last]
            hit = [e for e in elig if any(firsts[e] < y <= firsts[e] + k for y in yrs_by_ent[e])]
            # every appearance
            pairs = [(e, y) for e, ys in yrs_by_ent.items() for y in ys if y + k <= last]
            hit_all = [(e, y) for e, y in pairs if any(y < y2 <= y + k for y2 in yrs_by_ent[e])]
            rows.append(dict(rule=label, country=country, window=f"within {k}y", first_n=len(elig),
                             first_repeat=len(hit), first_share=len(hit) / max(len(elig), 1),
                             all_n=len(pairs), all_repeat=len(hit_all), all_share=len(hit_all) / max(len(pairs), 1)))
        elig = [e for e, y0 in firsts.items() if y0 + 5 <= last]
        hit = [e for e in elig if len(yrs_by_ent[e]) > 1]
        rows.append(dict(rule=label, country=country, window="ever (first year <= last-5)", first_n=len(elig),
                         first_repeat=len(hit), first_share=len(hit) / max(len(elig), 1)))
    t = pd.DataFrame(rows)
    pooled = t.groupby(["rule", "window"], as_index=False)[["first_n", "first_repeat", "all_n", "all_repeat"]].sum()
    pooled["country"] = "ALL"
    pooled["first_share"] = pooled.first_repeat / pooled.first_n
    pooled["all_share"] = pooled.all_repeat / pooled.all_n.replace(0, np.nan)
    return pd.concat([t, pooled], ignore_index=True)


coe = lots[lots.tier == "CoE"].copy()
cy = country_years(coe)
say("\n## Competition years held (CoE tier, in data)")
for c, ys in cy.items():
    gaps = [y for y in range(min(ys), max(ys) + 1) if y not in ys]
    say(f"{c}: {len(ys)} years {min(ys)}-{max(ys)}; missing years: {gaps}")

rep_all = []
pys = {}
for rule in ["standard", "strict", "name_only"]:
    py = placements(coe, f"ent_{rule}")
    pys[rule] = py
    rep_all.append(repeat_table(py, cy, rule))
rep = pd.concat(rep_all, ignore_index=True)
rep.to_csv(os.path.join(OUT, "repeat_appearance.csv"), index=False)
say("\n## 1. Repeat appearance (CoE tier)")
for rule in ["standard", "strict", "name_only"]:
    py = pys[rule]
    nyrs = py.groupby("ent")["year"].nunique()
    say(f"\n[{rule}] entities: {py.ent.nunique()}, entity-years: {len(py)}; entities with >=2 placing years: "
        f"{(nyrs >= 2).sum()} ({(nyrs >= 2).mean():.1%}); >=3: {(nyrs >= 3).sum()}; >=5: {(nyrs >= 5).sum()}; max {nyrs.max()}")
    say(rep[rep.rule == rule].drop(columns="rule").to_string(index=False, float_format=lambda x: f"{x:.3f}"))

py = pys["standard"]
top_ents = py.groupby("ent").agg(years=("year", "nunique"), farm=("farm", "first"), farmer=("farmer", "first"),
                                 country=("country", "first"), first=("year", "min"), last=("year", "max"),
                                 best=("score_num", "max")).sort_values("years", ascending=False)
top_ents.head(25).to_csv(os.path.join(OUT, "most_frequent_farms.csv"))
say("\nMost frequent placers (standard rule):\n" + top_ents.head(15).to_string())

# repeat rate by placement position (does placing high predict returning?)
say("\n### Return within 3 years, by placement in source year (standard rule, all appearances)")
rows = []
for country, g in py.groupby("country"):
    last = max(cy[country])
    ys = g.groupby("ent")["year"].apply(set).to_dict()
    for _, r in g.iterrows():
        if r.year + 3 > last or pd.isna(r.pos):
            continue
        rows.append(dict(country=country, top10=r.pos <= 10, pct=r.pct,
                         back=any(r.year < y <= r.year + 3 for y in ys[r.ent])))
bp = pd.DataFrame(rows)
tb = bp.groupby("top10")["back"].agg(["size", "sum", "mean"])
say(tb.to_string())
ct = pd.crosstab(bp.top10, bp.back)
chi = stats.chi2_contingency(ct)
say(f"chi2 p = {chi[1]:.4g}")
lr = smf.logit("back ~ pct + C(country)", data=bp.assign(back=bp.back.astype(int))).fit(disp=0)
say(f"logit back~pct+country: coef pct = {lr.params['pct']:.3f} (se {lr.bse['pct']:.3f}, p {lr.pvalues['pct']:.3g}); "
    f"implied P(back) at pct=0.1 vs 0.9 (avg country mix): "
    f"{lr.predict(bp.assign(pct=0.1)).mean():.3f} vs {lr.predict(bp.assign(pct=0.9)).mean():.3f}")
tb.to_csv(os.path.join(OUT, "return_by_top10.csv"))


# ---------------------------------------------------------------- 2. score persistence
def make_pairs(py, max_gap=None):
    py = py.sort_values(["ent", "year"])
    nxt = py.groupby("ent").shift(-1)
    pr = pd.DataFrame({
        "ent": py.ent, "country": py.country, "y1": py.year, "y2": nxt.year,
        "s1": py.score_num, "s2": nxt.score_num, "d1": py.score_dm, "d2": nxt.score_dm,
        "p1": py.pct, "p2": nxt.pct, "pos1": py.pos, "pos2": nxt.pos,
    }).dropna(subset=["y2"])
    if max_gap:
        pr = pr[pr.y2 - pr.y1 <= max_gap]
    return pr


def perm_null(pr, py, metric):
    """Null: replace each pair's second appearance with a random *other* farm placing in the same country-year."""
    src = {"d": "score_dm", "p": "pct", "s": "score_num"}[metric]
    sub = py[["country", "year", "ent", src]].dropna()
    pools = {}
    for (c, y), g in sub.groupby(["country", "year"]):
        pools[(c, int(y))] = (g[src].to_numpy(dtype=float), g["ent"].to_numpy(dtype=str))
    cands = []
    for c, y2, e in zip(pr.country.tolist(), pr.y2.astype(int).tolist(), pr.ent.tolist()):
        vals, ents = pools[(c, y2)]
        cands.append(vals[ents != e])
    lens = np.array([len(v) for v in cands])
    flat = np.concatenate(cands)
    offs = np.concatenate([[0], np.cumsum(lens)[:-1]])
    x = pr[metric + "1"].to_numpy(dtype=float)
    draws = offs[None, :] + (RNG.random((N_PERM, len(pr))) * lens[None, :]).astype(int)
    Y = flat[draws]
    xc = x - x.mean()
    Yc = Y - Y.mean(axis=1, keepdims=True)
    return (Yc @ xc) / (np.sqrt((Yc ** 2).sum(axis=1)) * np.sqrt((xc ** 2).sum()))


say("\n## 2. Score / rank persistence between consecutive appearances (standard rule, CoE tier)")
corr_rows = []
for max_gap in [1, 3, None]:
    pr = make_pairs(py, max_gap).dropna(subset=["d1", "d2"])
    for metric, label in [("d", "score minus competition mean"), ("p", "score percentile within competition"), ("s", "raw score")]:
        r, p = stats.pearsonr(pr[metric + "1"], pr[metric + "2"])
        rho, _ = stats.spearmanr(pr[metric + "1"], pr[metric + "2"])
        nul = perm_null(pr, py, metric)
        corr_rows.append(dict(max_gap=max_gap or "any", metric=label, n_pairs=len(pr), n_farms=pr.ent.nunique(),
                              pearson=r, pearson_p=p, spearman=rho, null_mean=nul.mean(),
                              null_lo=np.quantile(nul, 0.025), null_hi=np.quantile(nul, 0.975),
                              perm_p=(np.sum(nul >= r) + 1) / (N_PERM + 1)))
ct_ = pd.DataFrame(corr_rows)
ct_.to_csv(os.path.join(OUT, "score_persistence.csv"), index=False)
say(ct_.to_string(index=False, float_format=lambda x: f"{x:.3f}"))

say("\nBy country (consecutive appearances <=3y apart, demeaned score):")
bc = []
pr3 = make_pairs(py, 3).dropna(subset=["d1", "d2"])
for c, g in pr3.groupby("country"):
    if len(g) >= 8:
        r, p = stats.pearsonr(g.d1, g.d2)
        bc.append(dict(country=c, n_pairs=len(g), pearson=r, p=p))
bc = pd.DataFrame(bc)
say(bc.to_string(index=False, float_format=lambda x: f"{x:.3f}"))
bc.to_csv(os.path.join(OUT, "score_persistence_by_country.csv"), index=False)

# top-10 persistence among returners
pr3 = pr3.assign(t1=pr3.pos1 <= 10, t2=pr3.pos2 <= 10)
say("\nAmong returners (<=3y): P(top-10 next time | top-10 now) vs P(top-10 next | not top-10 now)")
say(pr3.groupby("t1")["t2"].agg(["size", "mean"]).to_string())
base_top10 = (py.pos <= 10).mean()
say(f"Unconditional share of placements that are top-10: {base_top10:.3f}")

# Sensitivity: strict and name-only resolution
say("\nSensitivity of demeaned-score correlation (<=3y) to entity rule:")
for rule in ["strict", "name_only"]:
    prr = make_pairs(pys[rule], 3).dropna(subset=["d1", "d2"])
    r, p = stats.pearsonr(prr.d1, prr.d2)
    say(f"  {rule}: n_pairs={len(prr)}, r={r:.3f}, p={p:.3g}")
# Sensitivity: include National Winner tier lots
allt = lots.copy()
py_nw = placements(allt, "ent_standard")
prn = make_pairs(py_nw, 3).dropna(subset=["d1", "d2"])
r, p = stats.pearsonr(prn.d1, prn.d2)
say(f"  standard incl. National Winner lots: n_pairs={len(prn)}, r={r:.3f}, p={p:.3g}")

# ---------------------------------------------------------------- 3. price
say("\n## 3. Reputation premium in auction price (CoE tier lots)")
lp = coe.dropna(subset=["price_usd_lb", "score_num"]).copy()
lp = lp[lp.price_usd_lb > 0]
lp["ent"] = lp["ent_standard"]
first_year = py.groupby("ent")["year"].min()
ent_years = py.groupby("ent")["year"].apply(set).to_dict()
data_start = coe.groupby("country")["year"].min()
lp["n_prior"] = [sum(1 for y in ent_years[e] if y < yr) for e, yr in zip(lp.ent, lp.year)]
lp["prior"] = (lp.n_prior > 0).astype(int)
prior_best = {}
for e, g in py.groupby("ent"):
    prior_best[e] = dict(zip(g.year, g.pos))
lp["prior_top10"] = [int(any(y < yr and (prior_best[e][y] <= 10) for y in ent_years[e])) for e, yr in zip(lp.ent, lp.year)]
lp["prior_win"] = [int(any(y < yr and (prior_best[e][y] <= 1) for y in ent_years[e])) for e, yr in zip(lp.ent, lp.year)]
lp["log_price"] = np.log(lp.price_usd_lb)
lp["sc"] = lp.score_num - 87
lp["sc2"] = lp.sc ** 2
lp["log_w"] = np.log(lp.weight_num.where(lp.weight_num > 0))
lp["yrs_in"] = lp.year - lp.country.map(data_start)
say(f"Lots with price and score: {len(lp)}; with a prior placement: {lp.prior.sum()} ({lp.prior.mean():.1%})")


def fit(formula, d, label):
    d = d.dropna(subset=[c for c in ["log_w"] if c in formula])
    m = smf.ols(formula, data=d).fit(cov_type="cluster", cov_kwds={"groups": pd.factorize(d.ent)[0]})
    return m, d


models = [
    ("base: score+score^2+prior+competition FE", "log_price ~ sc + sc2 + prior + C(slug)", lp),
    ("+ log lot size", "log_price ~ sc + sc2 + prior + log_w + C(slug)", lp),
    ("+ log lot size + Geisha", "log_price ~ sc + sc2 + prior + log_w + geisha + variety_known + C(slug)", lp),
    ("drop first 3 data years per country", "log_price ~ sc + sc2 + prior + log_w + C(slug)", lp[lp.yrs_in >= 3]),
    ("n prior placements (count)", "log_price ~ sc + sc2 + n_prior + log_w + C(slug)", lp),
    ("prior top-10 vs prior other vs none", "log_price ~ sc + sc2 + prior + prior_top10 + log_w + C(slug)", lp),
]
prow = []
for label, f, d in models:
    m, dd = fit(f, d, label)
    for term in ["prior", "n_prior", "prior_top10"]:
        if term in m.params:
            prow.append(dict(model=label, term=term, coef=m.params[term], se=m.bse[term], p=m.pvalues[term],
                             pct_effect=np.expm1(m.params[term]), n=int(m.nobs), r2=m.rsquared,
                             score_coef=m.params["sc"]))
            if term == "prior_top10":
                # prior_top10 is nested inside prior: a prior top-10 farm vs a farm with no prior placement is
                # prior + prior_top10, not prior_top10 alone (which is the increment over prior non-top-10 farms)
                tt = m.t_test("prior + prior_top10 = 0")
                c, se_c, p_c = float(np.squeeze(tt.effect)), float(np.squeeze(tt.sd)), float(np.squeeze(tt.pvalue))
                prow.append(dict(model=label, term="prior+prior_top10", coef=c, se=se_c, p=p_c, pct_effect=np.expm1(c),
                                 n=int(m.nobs), r2=m.rsquared, score_coef=m.params["sc"]))
prow = pd.DataFrame(prow)
say(prow.to_string(index=False, float_format=lambda x: f"{x:.3f}"))
prow.to_csv(os.path.join(OUT, "price_regressions.csv"), index=False)

lp["pos"] = lp.groupby("slug")["score_num"].rank(ascending=False, method="min")
lp["pos_b"] = pd.cut(lp.pos, [0, 1, 3, 10, 1000], labels=["1", "2-3", "4-10", "11+"])
m, _ = fit("log_price ~ sc + sc2 + C(pos_b) + prior + log_w + C(slug)", lp, "pos")
say(f"Robustness, + placement-position buckets (1, 2-3, 4-10, 11+): prior coef {m.params['prior']:.3f} "
    f"(se {m.bse['prior']:.3f}, p {m.pvalues['prior']:.3g}) => {np.expm1(m.params['prior']):+.1%}")
m, _ = fit("log_price ~ sc + sc2 + C(pos_b) + prior + prior_top10 + log_w + C(slug)", lp, "pos")
tt = m.t_test("prior + prior_top10 = 0")
c_top = float(np.squeeze(tt.effect))
say(f"Robustness, + position buckets, prior_top10 increment over prior non-top-10 {m.params['prior_top10']:.3f} "
    f"(se {m.bse['prior_top10']:.3f}, p {m.pvalues['prior_top10']:.3g}); prior (non-top-10) {m.params['prior']:.3f}; "
    f"prior top-10 vs no prior placement (prior + prior_top10) {c_top:.3f} (se {float(np.squeeze(tt.sd)):.3f}, "
    f"p {float(np.squeeze(tt.pvalue)):.3g}) => {np.expm1(c_top):+.1%}")
say(f"Scale: one cupping point ~ {np.expm1(prow.loc[prow.model == '+ log lot size', 'score_coef'].iloc[0]):+.1%} price at 87 points "
    f"(linear term; quadratic term makes the slope steeper at higher scores)")

say("\nBy country (base + log lot size):")
pc = []
for c, g in lp.groupby("country"):
    m, dd = fit("log_price ~ sc + sc2 + prior + log_w + C(slug)", g, c)
    pc.append(dict(country=c, n=int(m.nobs), n_prior=int(dd.prior.sum()), coef=m.params["prior"], se=m.bse["prior"],
                   p=m.pvalues["prior"], pct_effect=np.expm1(m.params["prior"])))
pc = pd.DataFrame(pc)
say(pc.to_string(index=False, float_format=lambda x: f"{x:.3f}"))
pc.to_csv(os.path.join(OUT, "price_by_country.csv"), index=False)

say("\nBy era (base + log lot size):")
for lo, hi in [(1999, 2010), (2011, 2018), (2019, 2026)]:
    g = lp[(lp.year >= lo) & (lp.year <= hi)]
    m, dd = fit("log_price ~ sc + sc2 + prior + log_w + C(slug)", g, "era")
    say(f"  {lo}-{hi}: n={int(m.nobs)}, prior coef={m.params['prior']:.3f} (se {m.bse['prior']:.3f}, p {m.pvalues['prior']:.3g}) "
        f"=> {np.expm1(m.params['prior']):+.1%}")

# entity fixed-effects check: within the same farm, is a later appearance priced higher at the same score?
m_fe = smf.ols("log_price ~ sc + sc2 + log_w + n_prior + C(slug) + C(ent)",
               data=lp.dropna(subset=["log_w"])[lp.dropna(subset=["log_w"]).groupby("ent").ent.transform("size") >= 2]).fit()
say(f"\nWithin-farm (farm FE, farms with >=2 priced lots): n_prior coef {m_fe.params['n_prior']:.3f} (se {m_fe.bse['n_prior']:.3f}, "
    f"p {m_fe.pvalues['n_prior']:.3g}), n={int(m_fe.nobs)}")

# ---------------------------------------------------------------- 4. buyers
say("\n## 4. Buyer relationships")
LEGAL = r"\b(co|ltd|inc|llc|corp|corporation|company|limited|gmbh|kk|sa|s a|pty|bv|ab|as|srl|sl|plc|the|coffee|roasters?|roastery|roasting|cafe)\b"


def buyer_set(s):
    if not isinstance(s, str) or not s.strip():
        return frozenset()
    s = re.sub(r"\((?:[^()]*)\)", " ", s)
    parts = re.split(r"//|,|;|\s/\s|\sand\s|\sfor\s|\+|\n", s, flags=re.I)
    out = set()
    for p in parts:
        k = fold(p)
        k = re.sub(LEGAL, " ", k)
        k = re.sub(r"\b(japan|korea|taiwan|china|usa|us|australia|south korea|hong kong|norway|uk|germany)\b", " ", k)
        k = re.sub(r"\s+", " ", k).strip()
        if len(k) >= 3 and k not in {"buying group", "group", "members", "japan buying group", "and"}:
            out.add(k)
    return frozenset(out)


coe["buyers"] = coe["buyer"].map(buyer_set)
by = coe[coe.buyers.map(len) > 0].copy()
say(f"Lots with parsed buyers: {len(by)}; distinct normalised buyer names: {len(set().union(*by.buyers))}")
top_b = pd.Series([b for s in by.buyers for b in s]).value_counts()
say("Most frequent buyers:\n" + top_b.head(15).to_string())
top_b.head(50).to_csv(os.path.join(OUT, "top_buyers.csv"))

eyb = by.groupby(["ent_standard", "country", "year"])["buyers"].agg(lambda s: frozenset().union(*s)).reset_index()
eyb = eyb.sort_values(["ent_standard", "year"])
eyb["next_year"] = eyb.groupby("ent_standard").year.shift(-1)
eyb["next_buyers"] = eyb.groupby("ent_standard").buyers.shift(-1)
bp_ = eyb.dropna(subset=["next_year"]).copy()
bp_["overlap"] = [len(a & b) > 0 for a, b in zip(bp_.buyers, bp_.next_buyers)]
pools = {k: list(g.buyers) for k, g in eyb.groupby(["country", "year"])}
pool_ents = {k: list(g.ent_standard) for k, g in eyb.groupby(["country", "year"])}
nulls = []
for b in range(500):
    hits = 0
    for _, r in bp_.iterrows():
        k = (r.country, int(r.next_year))
        cands = [s for s, e in zip(pools[k], pool_ents[k]) if e != r.ent_standard]
        hits += len(r.buyers & cands[RNG.integers(len(cands))]) > 0
    nulls.append(hits / len(bp_))
nulls = np.array(nulls)
say(f"Consecutive appearance pairs with buyer data on both: {len(bp_)} (farms: {bp_.ent_standard.nunique()})")
say(f"Share where at least one buyer repeats: {bp_.overlap.mean():.3f} ({bp_.overlap.sum()}/{len(bp_)}); "
    f"chance (same buyer on a random other farm's lot that year): {nulls.mean():.3f} "
    f"[95% {np.quantile(nulls, .025):.3f}-{np.quantile(nulls, .975):.3f}]; lift {bp_.overlap.mean() / nulls.mean():.2f}x")
for g_, lab in [(bp_[bp_.next_year - bp_.year <= 1], "next year"), (bp_[bp_.next_year - bp_.year > 1], "gap >1y")]:
    say(f"  {lab}: n={len(g_)}, repeat-buyer share={g_.overlap.mean():.3f}")
# farms with any buyer recurring across >=2 of their years
fb = defaultdict(lambda: defaultdict(set))
for _, r in eyb.iterrows():
    for b in r.buyers:
        fb[r.ent_standard][b].add(r.year)
multi = [e for e in fb if eyb[eyb.ent_standard == e].year.nunique() >= 2]
rep_f = [e for e in multi if any(len(ys) >= 2 for ys in fb[e].values())]
pairs_bf = sorted(((e, b, len(ys)) for e in fb for b, ys in fb[e].items() if len(ys) >= 2), key=lambda x: -x[2])
say(f"Farms with buyer data in >=2 years: {len(multi)}; with any buyer winning them in >=2 years: {len(rep_f)} "
    f"({len(rep_f) / max(len(multi), 1):.1%}); distinct repeat buyer-farm pairs: {len(pairs_bf)}")
bf = pd.DataFrame(pairs_bf, columns=["ent", "buyer", "n_years"])
bf["farm"] = bf.ent.map(py.groupby("ent").farm.first())
bf["country"] = bf.ent.str.split("|").str[0]
bf.to_csv(os.path.join(OUT, "repeat_buyer_farm_pairs.csv"), index=False)
say("Top repeat buyer-farm pairs:\n" + bf.head(15)[["country", "farm", "buyer", "n_years"]].to_string(index=False))
# sensitivity: drop Wataru (a buying agent that bids on behalf of many roasters)
bpw = bp_.assign(b1=bp_.buyers.map(lambda x: x - {"wataru"}), b2=bp_.next_buyers.map(lambda x: x - {"wataru"}))
bpw = bpw[(bpw.b1.map(len) > 0) & (bpw.b2.map(len) > 0)]
ov_w = np.mean([len(a & b) > 0 for a, b in zip(bpw.b1, bpw.b2)])
nw_ = []
for b in range(300):
    hits = 0
    for _, r in bpw.iterrows():
        k = (r.country, int(r.next_year))
        # condition the null like the observed sample: only candidates with a non-Wataru buyer left
        cands = [x - {"wataru"} for x, e in zip(pools[k], pool_ents[k]) if e != r.ent_standard and x - {"wataru"}]
        hits += len(r.b1 & cands[RNG.integers(len(cands))]) > 0
    nw_.append(hits / len(bpw))
say(f"Excluding Wataru: n={len(bpw)}, repeat-buyer share {ov_w:.3f} vs chance {np.mean(nw_):.3f} (lift {ov_w / np.mean(nw_):.2f}x)")
by_country = bp_.groupby("country").overlap.agg(["size", "mean"])
say("By country:\n" + by_country.to_string())
log_f.close()
