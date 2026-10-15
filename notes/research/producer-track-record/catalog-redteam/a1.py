import pandas as pd, numpy as np
import statsmodels.formula.api as smf
d=pd.read_csv('catalog.csv',low_memory=False)
print("rows",len(d),"wholesale",d.wholesale.sum())
x=d[(d.wholesale!=True)&d.price_per_lb.notna()&d.score_value.notna()&(d.price_per_lb>2)&(d.price_per_lb<200)&(d.score_value>=75)&(d.score_value<=100)].copy()
x['lp']=np.log(x.price_per_lb)
x['country']=x.country.fillna('NA')
print("n hedonic",len(x),"suppliers",x.source.nunique(), "score coverage among retail priced", round(d[(d.wholesale!=True)&d.price_per_lb.notna()].score_value.notna().mean(),3))
print("score coverage by supplier (share of retail rows with score):")
r=d[(d.wholesale!=True)]
cov=r.groupby('source').score_value.apply(lambda s:s.notna().mean()).sort_values()
print("suppliers with 0 score:", (cov==0).sum(), "of", len(cov))
for f in ['lp~score_value','lp~C(source)','lp~C(country)','lp~score_value+C(country)','lp~score_value+C(source)','lp~score_value+C(source)+C(country)']:
    m=smf.ols(f,data=x).fit(); print(f, "R2=%.3f"%m.rsquared, ("score coef=%.4f"%m.params['score_value']) if 'score_value' in m.params else '')
# within-supplier score effect
m=smf.ols('lp~score_value+C(source)+C(country)',data=x).fit()
print("within supplier+country: 1 pt ->", round((np.exp(m.params['score_value'])-1)*100,1),"%")
# price dispersion within score bands
x['band']=pd.cut(x.score_value,[0,84,86,88,90,100],labels=['<84','84-86','86-88','88-90','90+'])
g=x.groupby('band',observed=True).price_per_lb.describe(percentiles=[.1,.5,.9])
print(g[['count','10%','50%','90%']].round(2))
# supplier score calibration: same country, mean score by supplier (top countries)
for c in ['Ethiopia','Colombia','Kenya']:
    s=x[x.country==c].groupby('source').agg(n=('score_value','size'),mean_score=('score_value','mean'),med_price=('price_per_lb','median'))
    s=s[s.n>=8].sort_values('mean_score')
    print(c, "supplier mean score range %.1f-%.1f"%(s.mean_score.min(),s.mean_score.max()), "n_sup",len(s))
    print(s.round(2).to_string())
