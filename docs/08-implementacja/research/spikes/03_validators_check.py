import re
def pesel(s):
    if not re.fullmatch(r"\d{11}", s): return False
    w=[1,3,7,9,1,3,7,9,1,3]; d=[int(c) for c in s]
    return (10 - sum(a*b for a,b in zip(d,w))%10)%10 == d[10]
def nip(s):
    s=s.replace("-",""); 
    if not re.fullmatch(r"\d{10}", s): return False
    w=[6,5,7,2,3,4,5,6,7]; d=[int(c) for c in s]
    r=sum(a*b for a,b in zip(d,w))%11
    return r!=10 and r==d[9]
def regon(s):
    if not re.fullmatch(r"\d{9}|\d{14}", s): return False
    d=[int(c) for c in s]
    w9=[8,9,2,3,4,5,6,7]; r=sum(a*b for a,b in zip(d,w9))%11; r=0 if r==10 else r
    if r!=d[8]: return False
    if len(s)==14:
        w14=[2,4,8,5,0,9,7,3,6,1,2,4,8]; r=sum(a*b for a,b in zip(d,w14))%11; r=0 if r==10 else r
        return r==d[13]
    return True
def idcard(s):
    s=s.upper()
    if not re.fullmatch(r"[A-Z]{3}\d{6}", s): return False
    v=[ord(c)-55 if c.isalpha() else int(c) for c in s]
    w=[7,3,1,9,7,3,1,7,3]
    return sum(a*b for a,b in zip(v,w))%10==0
def idcard_gist(s):
    s=s.upper(); v=[ord(c)-55 if c.isalpha() else int(c) for c in s]
    seq=v[:3]+v[4:]; w=[7,3,1]
    return sum(x*w[i%3] for i,x in enumerate(seq))%10==v[3]
print("PESEL 55030101193", pesel("55030101193"), "| 55030101194", pesel("55030101194"))
print("NIP 1234563218", nip("1234563218"), "| 123-456-32-18", nip("123-456-32-18"), "| 1234567890", nip("1234567890"))
print("REGON 123456785", regon("123456785"), "| 12345678512347", regon("12345678512347"), "| 123456786", regon("123456786"))
print("ID ZZC108201 full-9-weights", idcard("ZZC108201"), "| gist-style", idcard_gist("ZZC108201"), "| ZZC208201", idcard("ZZC208201"))
print("ADE", bool(re.fullmatch(r"AE:PL-\d{5}-\d{5}-[A-Z]{5}-\d{2}", "AE:PL-97086-47802-BUFIW-21")))
