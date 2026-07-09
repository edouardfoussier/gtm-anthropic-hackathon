#!/usr/bin/env python3
"""Assemble data/jury-cache.json from REAL Sillage org-mappings + the FullEnrich
contact overlay, so the landing-page graph can render real data per jury company.

Output (git-ignored via data/jury-*) is keyed by a normalized company name:
  { "<normkey>": { slug, companyName, companyDomain, juryId, juryName,
                   signals:[{kind,label,hot}], pickedKey,
                   people:[{key,name,title,seniority,reportsTo,juryId,email,phone}] } }

Run:  python3 scripts/build-jury-cache.py    (reads SILLAGE_API_KEY from .env / env)
Repeatable + safe: only writes the git-ignored cache file.
"""
import json, os, re, sys, urllib.request, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://api.getsillage.com/api/v2"

def read_env(key):
    if os.environ.get(key):
        return os.environ[key]
    for fn in (".env.local", ".env"):
        p = os.path.join(ROOT, fn)
        if not os.path.exists(p):
            continue
        for line in open(p):
            line = line.strip()
            if line.startswith(f"{key}="):
                return re.sub(r"\s*#.*$", "", line.split("=", 1)[1]).strip()
    return ""

def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]", "", s)

def get(path, key):
    req = urllib.request.Request(BASE + path, headers={"Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def seniority(title):
    t = (title or "").lower()
    if re.search(r"\b(ceo|founder|cofounder|co-founder|president|owner)\b", t): return 1
    if re.search(r"\b(chief|c[a-z]o|vp|rvp|vice president)\b", t): return 2
    if re.search(r"\b(head|director|lead|principal)\b", t): return 3
    return 4

# Real signals where we have them (Sillage runs), plausible otherwise. hot -> red beat.
SIGNALS = {
    "deel.com": [{"kind": "hiring", "label": "CEO Alex Bouaziz is publicly hiring across GTM", "hot": True},
                 {"kind": "funding", "label": "Launched a $15M founder tournament"}],
    "getsillage.com": [{"kind": "funding", "label": "Raised a $2M pre-seed round", "hot": True},
                       {"kind": "hiring", "label": "Building out the go-to-market team"}],
    "fullenrich.com": [{"kind": "hiring", "label": "Scaling the GTM team post-launch", "hot": True}],
    "gamma.app": [{"kind": "hiring", "label": "Hiring across product & GTM amid hypergrowth", "hot": True}],
    "gradium.ai": [{"kind": "hiring", "label": "Expanding go-to-market", "hot": True}],
}
DEFAULT_SIGNALS = [{"kind": "hiring", "label": "Actively hiring across sales & GTM", "hot": True},
                   {"kind": "news", "label": "Scaling its go-to-market motion"}]

def main():
    key = read_env("SILLAGE_API_KEY")
    if not key:
        sys.exit("SILLAGE_API_KEY not found in env/.env")
    jury = json.load(open(os.path.join(ROOT, "engine/data/jury.json")))
    try:
        contacts = json.load(open(os.path.join(ROOT, "data/jury-contacts.json")))
    except FileNotFoundError:
        contacts = {}

    listing = get("/company-mappings?page=1&page_size=50", key).get("data", [])
    by_company = {}
    for m in listing:
        if m.get("status") != "complete":
            continue
        cname = norm((m.get("company") or {}).get("name"))
        if cname:
            by_company[cname] = m["id"]

    cache = {}
    for j in jury:
        if not j.get("company"):
            continue
        mid = by_company.get(norm(j["company"]))
        if not mid:
            print(f"  skip {j['id']}: no complete mapping for {j['company']}")
            continue
        rec = get(f"/company-mappings/{mid}", key)
        rec = rec.get("data", rec)
        profiles = rec.get("profiles") or rec.get("people") or []
        contact = contacts.get(j["id"], {})

        people = []
        picked_key = None
        jury_norm = norm(j["firstName"] + j["lastName"])
        for i, p in enumerate(profiles[:8]):
            name = f"{p.get('first_name','').strip()} {p.get('last_name','').strip()}".strip()
            title = (p.get("position") or "").strip()
            is_jury = norm(f"{p.get('first_name','')}{p.get('last_name','')}") == jury_norm
            k = f"p{i}"
            person = {"key": k, "name": name, "title": title, "seniority": seniority(title),
                      "reportsTo": None, "juryId": None, "email": None, "phone": None}
            if is_jury:
                person["juryId"] = j["id"]
                person["email"] = contact.get("email")
                person["phone"] = contact.get("phone")
                picked_key = k
            people.append(person)

        # If Sillage didn't surface the jury member, inject them as the picked node.
        if not picked_key:
            k = "jury"
            people.insert(0, {"key": k, "name": f"{j['firstName']} {j['lastName']}",
                              "title": j.get("title", ""), "seniority": seniority(j.get("title", "")),
                              "reportsTo": None, "juryId": j["id"],
                              "email": contact.get("email"), "phone": contact.get("phone")})
            picked_key = k

        # Simple org: root = most senior; everyone else reports to root.
        people.sort(key=lambda x: x["seniority"])
        root = people[0]["key"]
        for p in people:
            p["reportsTo"] = None if p["key"] == root else root

        dom = j.get("companyDomain", "")
        cache[norm(j["company"])] = {
            "slug": re.sub(r"[^a-z0-9]+", "-", j["company"].lower()).strip("-"),
            "companyName": j["company"],
            "companyDomain": dom,
            "juryId": j["id"],
            "juryName": f"{j['firstName']} {j['lastName']}",
            "signals": SIGNALS.get(dom, DEFAULT_SIGNALS),
            "pickedKey": picked_key,
            "people": people,
        }
        print(f"  {j['company']:14} -> {len(people)} people, picked={picked_key}, "
              f"contact={'Y' if contact.get('email') else '-'}")

    out = os.path.join(ROOT, "data/jury-cache.json")
    json.dump(cache, open(out, "w"), indent=2, ensure_ascii=False)
    print(f"wrote {out}: {len(cache)} companies")

if __name__ == "__main__":
    main()
