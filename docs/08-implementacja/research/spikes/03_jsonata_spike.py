import json, glob, sys
import jsonata

# 1. parse all golden queries
queries = []
def walk(o):
    if isinstance(o, dict):
        for s in o.get("states", []) or []:
            if isinstance(s, dict) and s.get("query"):
                queries.append(s["query"])
        for v in o.values(): walk(v)
    elif isinstance(o, list):
        for v in o: walk(v)
for f in sorted(glob.glob(sys.argv[1] + "/*.json")):
    walk(json.load(open(f)))
print("queries:", len(queries), "unique:", len(set(queries)))
bad = 0
for q in set(queries):
    try:
        jsonata.Jsonata(q)
    except Exception as e:
        bad += 1; print("PARSE FAIL", type(e).__name__, e, repr(q[:80]))
print("parse failures:", bad)

# 2. parse error class
for q in ['"Polska" in tabs[', '$not(', 'a and', '"x" in tabs[\'Dane\' in title].questions[\'s\' in field.techName].field.repeatingSectionGrid[\'k\' in field.techName].field.__userAnswer)']:
    try:
        jsonata.Jsonata(q); print("OK?", q)
    except Exception as e:
        print("ERR", type(e).__module__, type(e).__name__, "|", str(e)[:100])

# 3. semantics on a mock runtime structure
def mk(tab_title, sec, fld, ans):
    return {"tabs":[{"title":tab_title,"questions":[{"field":{"techName":sec,"repeatingSectionGrid":[{"field":{"techName":fld,"__userAnswer":ans}}]}}]}]}
Q = '("Polska" in tabs[\'Dane\' in title].questions[\'adres_zamieszkania\' in field.techName].field.repeatingSectionGrid[\'kraj\' in field.techName].field.__userAnswer)'
NQ = '$not' + Q
e, ne = jsonata.Jsonata(Q), jsonata.Jsonata(NQ)
for ans in ["Polska", ["Polska"], "Niemcy", ["Niemcy","Polska"], None, "", []]:
    d = mk("Dane","adres_zamieszkania","kraj",ans)
    print(f"ans={ans!r:22} SHOW={e.evaluate(d)!r:6} NOT={ne.evaluate(d)!r}")
# missing field entirely
d = mk("Dane","adres_zamieszkania","inne","Polska")
print("missing field ->", e.evaluate(d), "| not ->", ne.evaluate(d))
# title substring semantics: 'Dane' in title where title is a string
d = mk("Dane do kontaktu","adres_zamieszkania","kraj","Polska")
print("tab title 'Dane do kontaktu' matches 'Dane' in title? ->", e.evaluate(d))
# unbound variable
try:
    print("unbound $repeatingSectionIndex ->", jsonata.Jsonata("$repeatingSectionIndex").evaluate({}))
except Exception as ex:
    print("unbound var ERR", type(ex).__name__, ex)
# bind it
ex2 = jsonata.Jsonata("tabs.questions.field.__userAnswer[$repeatingSectionIndex]['pole_1' in fieldTechName].answers")
ex2.assign("repeatingSectionIndex", 1)
print("repeating ->", ex2.evaluate({"tabs":[{"questions":[{"field":{"__userAnswer":[[{"fieldTechName":"pole_1","answers":["A"]}],[{"fieldTechName":"pole_1","answers":["B"]}]]}}]}]}))
# multi-line and/or
ML = '("A" in tabs[\'Dane\' in title].questions[\'s\' in field.techName].field.repeatingSectionGrid[\'f\' in field.techName].field.__userAnswer)\n\nor \n\n(\n\n("B" in tabs[\'Dane\' in title].questions[\'s\' in field.techName].field.repeatingSectionGrid[\'f\' in field.techName].field.__userAnswer)\n\nand \n\n("C" in tabs[\'Dane\' in title].questions[\'s\' in field.techName].field.repeatingSectionGrid[\'g\' in field.techName].field.__userAnswer)\n\n\n)'
print("multiline parse ok:", bool(jsonata.Jsonata(ML)))
