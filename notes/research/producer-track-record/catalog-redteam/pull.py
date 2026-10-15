import os, urllib.parse, psycopg, csv
p=urllib.parse.urlparse(os.environ["SUPABASE_READONLY_URL"])
c=psycopg.connect(host="aws-0-us-west-1.pooler.supabase.com",port=6543,user=f"{p.username}.bjblfzfdtfvuitqdbodn",password=urllib.parse.unquote(p.password),dbname=p.path.lstrip("/") or "postgres",sslmode="require",prepare_threshold=None)
cur=c.cursor(); cur.execute("BEGIN TRANSACTION READ ONLY")
cur.execute("select current_user, current_setting('transaction_read_only')"); print(cur.fetchone())
cur.execute("""SELECT id,name,source,country,region,subregion,site,farmer,cooperative,score_value,price_per_lb,cost_lb,wholesale,processing,processing_base_method,
 drying_method,cultivar_detail,cupping_notes,ai_tasting_notes::text,arrival_date,stocked,stocked_date,unstocked_date,last_updated,length(farm_notes) farm_len,farm_notes,description_long,elevation_min_masl
 FROM coffee_catalog""")
cols=[d.name for d in cur.description]
with open('/home/openclaw/.openclaw/workspace/tmp/ctx_redteam/catalog.csv','w',newline='') as f:
    w=csv.writer(f); w.writerow(cols); n=0
    for r in cur: w.writerow(r); n+=1
print(n)
cur.execute("ROLLBACK")
