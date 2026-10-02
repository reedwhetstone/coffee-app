import pandas as pd, numpy as np, re, unicodedata
d=pd.read_csv('catalog.csv',low_memory=False)
def pm(s):
    try: return pd.to_datetime(s, format='%B %Y')
    except: return pd.NaT
d['arr']=d.arrival_date.map(pm); d['sd']=pd.to_datetime(d.stocked_date,errors='coerce')
d['age_mo']=(d.sd-d.arr).dt.days/30.4
st=d[(d.stocked==True)&(d.wholesale!=True)]
a=st.age_mo.dropna()
now=pd.Timestamp('2026-10-01')
cur_age=((now-st.arr).dt.days/30.4).dropna()
print("stocked retail parseable arrival",len(cur_age),"of",len(st)," months since arrival: median %.1f; >12mo %.1f%%; >18mo %.1f%%"%(cur_age.median(),100*(cur_age>12).mean(),100*(cur_age>18).mean()))
print("future arrival (forward listed) share %.1f%%"%(100*(cur_age<0).mean()))
s=d[d.source=='showroom_coffee']
print("showroom age at listing by name contains Natural:", s[s.name.str.contains('Natural',case=False)].age_mo.median().round(1), "washed:", s[s.name.str.contains('Washed',case=False)].age_mo.median().round(1))
# same farm across suppliers
def norm(x):
    x=unicodedata.normalize('NFKD',str(x)).encode('ascii','ignore').decode().lower()
    x=re.sub(r'\b(finca|hacienda|granja|fazenda|sitio|estate|farm|la|el|los|las|de|del)\b',' ',x)
    return re.sub(r'[^a-z0-9 ]',' ',x).split()
d['sk']=d.site.where(d.site.notna()&(d.site.astype(str).str.strip()!='')).map(lambda v:' '.join(norm(v)) if isinstance(v,str) else None)
g=d.dropna(subset=['sk']).groupby('sk')
exact=d.dropna(subset=['site']).groupby(d.site.str.lower().str.strip()).source.nunique()
print("sites exact multi-supplier",(exact>1).sum(),"normalized multi-supplier",(g.source.nunique()>1).sum(), "distinct normalized",g.ngroups)
span=g.sd.agg(lambda s:(s.max()-s.min()).days)
print("normalized sites seen across >300 days:",(span>300).sum(), " >180 days:",(span>180).sum())
for k in ['ratnagiri','kayon mountain','pirineos']:
    sub=d[d.sk.fillna('').str.contains(k)][['source','name','score_value','price_per_lb','wholesale','stocked_date','cupping_notes']]
    print('\n==',k); print(sub.sort_values('source').to_string(max_colwidth=70))
