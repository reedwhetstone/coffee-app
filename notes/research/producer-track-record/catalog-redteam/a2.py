import pandas as pd, numpy as np, re
d=pd.read_csv('catalog.csv',low_memory=False)
r=d[d.wholesale!=True].copy()
fruit=r'\b(berry|berries|blueberry|strawberry|raspberry|blackberry|cherry|grape|wine|winey|tropical|mango|pineapple|papaya|passion ?fruit|peach|apricot|plum|stone fruit|citrus|lemon|lime|orange|grapefruit|tangerine|mandarin|apple|pear|melon|watermelon|fruit|fruity|jammy|lychee|currant|fig|date|raisin|cranberry|guava|kiwi|banana|coconut)\b'
def proc(row):
    s=str(row.processing_base_method if pd.notna(row.processing_base_method) else row.processing).lower()
    if 'natural' in s or 'dry' in s: return 'natural'
    if 'honey' in s or 'pulped' in s: return 'honey'
    if 'wash' in s or 'wet' in s: return 'washed'
    return 'other/unknown'
r['proc']=r.apply(proc,axis=1)
r['notes']=(r.cupping_notes.fillna('')+' '+r.ai_tasting_notes.fillna('')).str.lower()
r['has_notes']=r.cupping_notes.fillna('').str.len()>10
r['fruit']=r.notes.str.contains(fruit,regex=True)
r['fruit_terms']=r.notes.str.count(fruit)
n=r[r.has_notes]
print("listings w/ cupping notes",len(n))
print(n.groupby('proc').agg(n=('fruit','size'),fruit_share=('fruit','mean'),avg_fruit_terms=('fruit_terms','mean')).round(2))
# supplier fruit share for washed
w=n[n.proc=='washed'].groupby('source').fruit.agg(['size','mean']); w=w[w['size']>=20].sort_values('mean')
print("washed fruit share by supplier range", w['mean'].min().round(2), w['mean'].max().round(2), len(w))
# arrival/harvest disclosure
st=r[r.stocked==True]
print("stocked retail",len(st)," arrival_date populated",round(st.arrival_date.notna().mean(),3))
harv=st.description_long.fillna('').str.contains(r'harvest|crop year|20(2[3-6])/(2[4-7])|new crop|past crop',case=False,regex=True)
print("stocked mentions harvest/crop year in description",round(harv.mean(),3))
ad=st.arrival_date.dropna().astype(str)
print("arrival_date sample formats", ad.sample(8,random_state=1).tolist())
# Showroom
s=r[r.source=='showroom_coffee']
print("showroom total",len(s),"stocked",(s.stocked==True).sum())
print(s.groupby('proc').agg(n=('id','size'),stocked=('stocked','sum'),score=('score_value','mean'),price=('price_per_lb','median'),fruit=('fruit','mean')).round(2))
sn=s[s.proc=='natural'][['name','country','score_value','price_per_lb','arrival_date','stocked','stocked_date','unstocked_date','cupping_notes']]
print(sn.sort_values('stocked_date').tail(12).to_string(max_colwidth=60))
print("showroom arrival_date populated",round(s.arrival_date.notna().mean(),2))
