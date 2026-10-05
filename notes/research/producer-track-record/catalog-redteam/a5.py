import pandas as pd, numpy as np
import statsmodels.formula.api as smf
d=pd.read_csv('catalog.csv',low_memory=False)
x=d[(d.wholesale!=True)&d.price_per_lb.notna()&d.score_value.notna()&(d.price_per_lb>2)&(d.price_per_lb<200)&(d.score_value>=75)&(d.score_value<=100)].copy()
x['lp']=np.log(x.price_per_lb); x['country']=x.country.fillna('NA')
m=smf.ols('lp~score_value+C(source)+C(country)',data=x).fit(cov_type='cluster',cov_kwds={'groups':x.source.astype('category').cat.codes})
print("score pt %.2f%% p=%.4f n=%d"%((np.exp(m.params['score_value'])-1)*100,m.pvalues['score_value'],len(x)))
m2=smf.ols('lp~score_value+C(source)+C(country)',data=x).fit()
print("nonclustered p=%.2e"%m2.pvalues['score_value'])
r=d[(d.wholesale!=True)&d.price_per_lb.between(2,200)].copy()
r['lp']=np.log(r.price_per_lb); r['country']=r.country.fillna('NA')
r['ident']=(r.site.fillna('').str.strip()!='')|(r.farmer.fillna('').str.strip()!='')|(r.cooperative.fillna('').str.strip()!='')
r['story_k']=r.farm_len.fillna(0)/1000
m3=smf.ols('lp~ident+story_k+C(source)+C(country)',data=r).fit(cov_type='cluster',cov_kwds={'groups':r.source.astype('category').cat.codes})
for k in ['ident[T.True]','story_k']:
    print(k,"%.1f%% p=%.4f ci=(%.1f,%.1f)"%((np.exp(m3.params[k])-1)*100,m3.pvalues[k],(np.exp(m3.conf_int().loc[k,0])-1)*100,(np.exp(m3.conf_int().loc[k,1])-1)*100))
print("ident share",r.ident.mean().round(3),"n",len(r),"suppliers",r.source.nunique())
