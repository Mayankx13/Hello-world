#!/usr/bin/env python3
"""Render the LIQO D1 schema as a grouped ER diagram (HTML → chromium PNG)."""
import html, subprocess, os

PAL = {
    "ref":   ("#211A12", "#33281B"),   # espresso
    "inv":   ("#1B7F4D", "#22965B"),   # mint
    "people":("#D9820A", "#F6A21E"),   # amber
    "cust":  ("#BC4A08", "#F1641E"),   # orange
    "comm":  ("#7A4B16", "#9A6322"),   # cocoa
    "view":  ("#6F6354", "#857865"),   # muted
}
DOM_LABEL = {
    "ref": "Reference", "inv": "Inventory", "people": "People",
    "cust": "Customers", "comm": "Commerce", "view": "Analytics views",
}
# table: (domain, x, y, [ (col, kind) ])  kind: pk|fk:target|uk|''
T = {
 "stores":   ("ref", 40, 84, [("store_id","pk"),("name",""),("region",""),("pilot · active","")]),
 "config":   ("ref", 40, 250, [("key","pk"),("value (JSON)",""),("version","")]),
 "offers":   ("ref", 40, 386, [("offer_id","pk"),("brand · category · sku",""),("store_id","fk:stores"),("boost_weight",""),("starts_at · ends_at","")]),
 "demand_requests":("ref",40,576,[("id","pk"),("store_id","fk:stores"),("customer_id","fk:customers"),("employee_id","fk:employees"),("category · brand · status","")]),

 "employees":("people",470,84,[("employee_id","pk"),("name · email","uk"),("role  (admin|mgr|sales)",""),("store_id","fk:stores"),("status","")]),
 "attendance":("people",470,268,[("id","pk"),("employee_id","fk:employees"),("store_id","fk:stores"),("date  ·  status",""),("(unique emp+date)","uk")]),
 "leaves":   ("people",470,450,[("id","pk"),("employee_id","fk:employees"),("type · from · to",""),("status · approver_id","")]),
 "milestones":("people",470,604,[("milestone_id","pk"),("metric · threshold",""),("period · reward_inr","")]),
 "incentives":("people",470,738,[("id","pk"),("employee_id","fk:employees"),("milestone_id","fk:milestones"),("points · amount_inr",""),("status","")]),
 "feedback": ("people",470,922,[("id","pk"),("employee_id","fk:employees"),("store_id","fk:stores"),("category · rating",""),("anonymous","")]),

 "customers":("cust",900,84,[("customer_id","pk"),("phone","uk"),("name · email",""),("premium_tier",""),("preferred_payment",""),("home_store_id","fk:stores")]),
 "customer_brand_prefs":("cust",900,300,[("id","pk"),("customer_id","fk:customers"),("brand · category",""),("affinity","")]),
 "customer_events":("cust",900,452,[("event_id","pk"),("customer_id","fk:customers"),("type · category · brand",""),("sku · amount · ts","")]),
 "inventory":("inv",900,636,[("id  (sku|store)","pk"),("store_id · channel",""),("category · brand · model",""),("price · mrp · margin",""),("stock_qty · band · tags",""),("last_synced_at","")]),

 "sessions": ("comm",1330,84,[("session_id","pk"),("user_id","fk:employees"),("customer_id","fk:customers"),("store_id","fk:stores"),("category · answers",""),("outcome · items_per_bill","")]),
 "suggested_products":("comm",1330,300,[("id","pk"),("session_id","fk:sessions"),("sku · brand · tier",""),("shown · chosen","")]),
 "sales":    ("comm",1330,452,[("sale_id","pk"),("bill_no","uk"),("customer_id","fk:customers"),("employee_id","fk:employees"),("store_id","fk:stores"),("session_id","fk:sessions"),("total · payment","")]),
 "sale_items":("comm",1330,690,[("id","pk"),("sale_id","fk:sales"),("sku · brand · category",""),("qty · unit_price",""),("recommended","")]),
}
VIEWS = [
 ("v_store_daily","bills · revenue · items/bill · reco%  per store·day"),
 ("v_demand_category","suggested vs sold · conversion  per store·category"),
 ("v_employee_month","bills · items/bill · incentive ₹  per emp·month"),
 ("v_customer_360","purchases · lifetime value · touchpoints · brands"),
]
ROW_H, HEAD_H, W = 22, 34, 360
def card_h(cols): return HEAD_H + len(cols)*ROW_H + 12

def anchor(name, side):
    dom,x,y,cols = T[name]; h = card_h(cols)
    return (x+(W if side=="r" else 0), y+h/2)

cards=[]
for name,(dom,x,y,cols) in T.items():
    dark,light = PAL[dom]
    rows=""
    for col,kind in cols:
        badge=""
        if kind=="pk": badge='<span class="b pk">PK</span>'
        elif kind=="uk": badge='<span class="b uk">U</span>'
        elif kind.startswith("fk:"):
            badge=f'<span class="b fk">▸ {kind[3:]}</span>'
        rows+=f'<div class="row"><span>{html.escape(col)}</span>{badge}</div>'
    cards.append(f'''<div class="card" style="left:{x}px;top:{y}px;width:{W}px">
      <div class="hd" style="background:{dark}">{name}<span class="dom" style="background:{light}">{DOM_LABEL[dom]}</span></div>{rows}</div>''')

# backbone FK edges
EDGES=[("employees","l","stores","r"),("attendance","l","employees","l"),("leaves","l","employees","l"),
 ("incentives","l","employees","l"),("incentives","l","milestones","l"),("feedback","l","employees","l"),
 ("customer_brand_prefs","l","customers","l"),("customer_events","l","customers","l"),
 ("sessions","l","customers","r"),("sessions","l","employees","r"),
 ("sales","l","customers","r"),("sales","l","sessions","l"),("sale_items","l","sales","l"),
 ("suggested_products","l","sessions","l"),("offers","r","stores","r"),
 ("customers","l","stores","r"),("demand_requests","r","customers","l")]
lines=""
for a,sa,b,sb in EDGES:
    x1,y1=anchor(a,sa); x2,y2=anchor(b,sb)
    mx=(x1+x2)/2
    lines+=f'<path d="M{x1},{y1} C{mx},{y1} {mx},{y2} {x2},{y2}" />'

views_html=""
for i,(n,d) in enumerate(VIEWS):
    vx=40+i*410
    views_html+=f'''<div class="card view" style="left:{vx}px;top:1180px;width:380px">
      <div class="hd" style="background:{PAL['view'][0]}">{n}<span class="dom" style="background:{PAL['view'][1]}">VIEW</span></div>
      <div class="row vrow">{html.escape(d)}</div></div>'''

H=1320
doc=f'''<!doctype html><html><head><meta charset="utf-8"><style>
*{{box-sizing:border-box;margin:0;font-family:'Public Sans',system-ui,sans-serif}}
body{{background:#FAF7F2;width:1740px;height:{H}px;position:relative}}
.title{{position:absolute;left:40px;top:24px;font-family:'Bricolage Grotesque',sans-serif}}
.title h1{{font-size:26px;color:#211A12;letter-spacing:-.01em}}
.title p{{font-size:13px;color:#6F6354;margin-top:3px}}
svg{{position:absolute;inset:0;width:1740px;height:{H}px;pointer-events:none}}
svg path{{fill:none;stroke:#D9820A;stroke-width:1.6;opacity:.5}}
.card{{position:absolute;background:#fff;border:1px solid #EAE2D6;border-radius:12px;
  box-shadow:0 6px 18px rgba(33,26,18,.06);overflow:hidden;z-index:2}}
.hd{{color:#fff;font-weight:800;font-size:14px;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;font-family:'Bricolage Grotesque',sans-serif}}
.dom{{font-size:9.5px;font-weight:700;color:#fff;padding:2px 7px;border-radius:20px;opacity:.95;text-transform:uppercase;letter-spacing:.04em}}
.row{{display:flex;justify-content:space-between;align-items:center;padding:3px 12px;font-size:12.5px;color:#33281B;border-top:1px solid #F4EEE4}}
.row span:first-child{{font-variant-numeric:tabular-nums}}
.b{{font-size:9px;font-weight:800;padding:1px 6px;border-radius:5px;letter-spacing:.03em}}
.pk{{background:#211A12;color:#fff}} .uk{{background:#FFF3DF;color:#BC4A08}} .fk{{background:#FFF3DF;color:#D9820A}}
.view .vrow{{font-size:12px;color:#6F6354;line-height:1.5}}
.legend{{position:absolute;right:40px;top:30px;display:flex;gap:14px;flex-wrap:wrap;max-width:560px;justify-content:flex-end}}
.lg{{display:flex;align-items:center;gap:6px;font-size:11.5px;color:#33281B}}
.dot{{width:12px;height:12px;border-radius:4px}}
</style></head><body>
<div class="title"><h1>LIQO — Cloudflare D1 data model</h1>
<p>18 tables + 4 analytics views · 3NF · FOREIGN KEYs enforced · CHECK-constrained enums · PK primary key · U unique · ▸ foreign key</p></div>
<div class="legend">{''.join(f'<div class="lg"><span class="dot" style="background:{PAL[k][1]}"></span>{v}</div>' for k,v in DOM_LABEL.items())}</div>
<svg>{lines}</svg>
{''.join(cards)}
{views_html}
</body></html>'''

scr=os.path.dirname(os.path.abspath(__file__))
hp=os.path.join(scr,"dbdiagram.html"); open(hp,"w").write(doc)
out="/home/user/Hello-world/docs/liqo-db-diagram.png"
os.makedirs(os.path.dirname(out),exist_ok=True)
subprocess.run(["/opt/pw-browsers/chromium-1194/chrome-linux/chrome","--headless=new","--no-sandbox","--hide-scrollbars",
  "--force-device-scale-factor=2","--window-size=1740,1320",
  f"--screenshot={out}",f"file://{hp}"],check=True,
  stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
print("wrote",out,os.path.getsize(out),"bytes")
