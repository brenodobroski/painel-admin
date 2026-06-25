import re

familias = [
    "COND BI SAMSUNG 18K","COND TRI SAMSUNG 24K","COND QUADRI SAMSUNG 28K","COND PENTA SAMSUNG 34K","COND PENTA SAMSUNG 48K",
    "EVAP HW SAMSUNG 7K","EVAP HW  SAMSUNG 9K","EVAP HW SAMSUNG 12K","EVAP HW SAMSUNG 18K","EVAP HW SAMSUNG 24K",
    "EVAP HW SAMSUNG BLACK 9K","EVAP HW SAMSUNG BLACK 12K","EVAP HW SAMSUNG BLACK 18K","EVAP HW SAMSUNG BLACK 24K",
    "EVAP K7 1 VIA SAMSUNG 9K","EVAP K7 1 VIA SAMSUNG 12K","EVAP K7 1 VIA SAMSUNG 18K","EVAP K7 1 VIA SAMSUNG 24K",
    "SAMSUNG GRELHA K7 1 VIA 9 A 12K","SAMSUNG GRELHA K7 1 VIA 18 A 24K",
    "EVAP K7 4 VIAS SAMSUNG  9K","EVAP K7 4 VIAS SAMSUNG 12K","EVAP K7 4 VIAS SAMSUNG 18K",
    "GRELHA K7 4 VIAS SAMSUNG","SAMSUNG CONTROLE SEM FIO","SAMSUNG KIT WI-FI","SAMSUNG PLACA DE INTERFACE HW",
    "COND BI LG 18K","COND TRI LG 21K","COND QUADRI LG 30K","COND PENTA LG 36K","COND PENTA LG 48K",
    "EVAP HW LG 7K","EVAP HW LG 9K","EVAP HW LG 12K","EVAP HW LG 18K","EVAP HW LG 24K",
    "EVAP HW ARTCOOL LG 7K","EVAP HW ARTCOOL LG 9K","EVAP HW ARTCOOL LG 12K",
    "EVAP K7 1 VIA LG 9K","EVAP K7 1 VIA LG 12K","EVAP K7 1 VIA LG 18K","EVAP K7 1 VIA LG 24K",
    "GRELHA K7 4 VIAS LG 9 A 12K","GRELHA K7 4 VIAS LG 18 A 24K",
    "EVAP K7 4 VIAS LG  9K","EVAP K7 4 VIAS LG  12K","EVAP K7 4 VIAS LG 18K","EVAP K7 4 VIAS LG 24K",
    "EVAP K7 360 LG 36K","EVAP BUILT IN DAIKIN 9K","EVAP BUILT IN DAIKIN 12K",
    "EVAP PISO FUJITSU 12K","EVAP PAINEL GALLERY LG  9K",
]

def chave(nome):
    n = nome.upper()
    btu_m = re.search(r"(\d+)\s*K", n)
    btu = int(btu_m.group(1)) if btu_m else 0
    if "COND" in n:
        sp = 1
        if "HEXA" in n: sp=6
        elif "PENTA" in n: sp=5
        elif "QUADRI" in n: sp=4
        elif "TRI" in n: sp=3
        elif "BI" in n: sp=2
        return sp*10000+btu
    if re.search(r"\bHW\b", n) and "BLACK" not in n: tp=1
    elif "BLACK" in n: tp=2
    elif re.search(r"K7.*1.*VIA", n) and "GRELHA" not in n: tp=3
    elif re.search(r"GRELHA.*K7.*1|K7.*1.*GRELHA", n): tp=4
    elif re.search(r"K7.*4.*VIAS", n) and "GRELHA" not in n: tp=5
    elif re.search(r"GRELHA.*K7.*4|K7.*4.*GRELHA", n): tp=6
    elif "BUILT" in n: tp=7
    elif "PISO" in n: tp=8
    elif "PAINEL" in n or "GALLERY" in n: tp=9
    elif re.search(r"K7.*360", n): tp=10
    elif "GRELHA" in n: tp=11
    elif re.search(r"CONTROLE|KIT.WI|WIFI|PLACA|INTERFACE", n): tp=12
    else: tp=13
    return tp*10000+btu

sams = sorted([f for f in familias if "SAMSUNG" in f.upper() or "GRELHA K7 4 VIAS SAMSUNG" in f.upper()], key=chave)
lgs  = sorted([f for f in familias if "LG" in f.upper()], key=chave)
print("=== SAMSUNG CONDENSADORAS ===")
for f in [x for x in sams if "COND" in x.upper()]: print(" ", f)
print("\n=== SAMSUNG EVAPORADORAS ===")
for f in [x for x in sams if "COND" not in x.upper()]: print(" ", f)
print("\n=== LG CONDENSADORAS ===")
for f in [x for x in lgs if "COND" in x.upper()]: print(" ", f)
print("\n=== LG EVAPORADORAS ===")
for f in [x for x in lgs if "COND" not in x.upper()]: print(" ", f)
