import pandas as pd, numpy as np, re
import statsmodels.formula.api as smf
d=pd.read_csv('catalog.csv',low_memory=False)
r=d[(d.wholesale!=True)&d.price_per_lb.between(2,200)].copy()
r['lp']=np.log(r.price_per_lb); r['country']=r.country.fillna('NA')
r['ident']=(r.site.fillna('').str.strip()!='')|(r.farmer.fillna('').str.strip()!='')|(r.cooperative.fillna('').str.strip()!='')
r['story']=r.farm_len.fillna(0)>40
r['story_k']=r.farm_len.fillna(0)/1000
m=smf.ols('lp~ident+story_k+C(source)+C(country)',data=r).fit()
print("n",len(r),"identity premium %.1f%% (p=%.3f); +1k chars story %.1f%% (p=%.3f)"%((np.exp(m.params['ident[T.True]'])-1)*100,m.pvalues['ident[T.True]'],(np.exp(m.params['story_k'])-1)*100,m.pvalues['story_k']))
# farm notes: verifiable specifics vs marketing
st=d[(d.stocked==True)&(d.farm_len>40)].farm_notes.fillna('')
checks={
 'elevation number':r'\b\d{3,4}\s?(m\b|masl|meters|metres|m\.a\.s\.l)',
 'farm size (ha/acres)':r'\b\d+(\.\d+)?\s?(ha\b|hectares?|acres?|manzanas?)',
 'year/founding/generation':r'\b(since|founded|established|in)\s(19|20)\d{2}\b|\bgeneration',
 'named variety':r'\b(bourbon|typica|caturra|catuai|gesha|geisha|pacamara|sl28|sl34|74110|74112|heirloom|castillo|catimor|sarchimor|ruiru|batian|maragogipe|java|pink bourbon|parainema|marsellesa)\b',
 'number of producers/smallholders':r'\b\d[\d,]*\s(smallholders?|farmers|producers|members|families|growers)',
 'processing specifics (hours/days)':r'\b\d+\s?(-\s?\d+\s?)?(hours?|hrs?|days)\b',
 'price/premium paid to producer':r'(premium|paid|price)[^.]{0,60}(\$|usd|per pound|per lb|per kg|above|fob|farm.?gate)',
}
for k,p in checks.items(): print("%-36s %.1f%%"%(k,100*st.str.contains(p,case=False,regex=True).mean()))
mk=r'\b(passion|passionate|dedicat\w*|commit\w*|love|family|tradition\w*|unique|exceptional|incredible|amazing|meticulous|care|careful|pride|proud|dream|vision|sustainab\w*|community)\b'
cnt=st.str.lower().str.count(mk); words=st.str.split().str.len()
print("marketing-vocab hits per 100 words: median %.1f"%((cnt/words*100).median()), " listings with >=3 hits %.0f%%"%(100*(cnt>=3).mean()))
print("n farm-notes stocked",len(st))
