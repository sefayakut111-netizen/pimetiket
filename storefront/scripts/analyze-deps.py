"""Dependency graph analysis — Pim Etiket modul haritasi."""
import json
import sys

# UTF-8 stdout (Windows console icin)
sys.stdout.reconfigure(encoding="utf-8")

with open("deps.json", encoding="utf-8") as f:
    deps = json.load(f)

# Outgoing count
outgoing = {f: len(imports) for f, imports in deps.items()}

# Incoming count
incoming = {}
for f, imports in deps.items():
    for imp in imports:
        incoming[imp] = incoming.get(imp, 0) + 1

print("=== TOP 15 HUB (en cok import EDILEN — kritik) ===")
for f, c in sorted(incoming.items(), key=lambda x: -x[1])[:15]:
    print(f"{c:4d}  {f}")

print()
print("=== TOP 10 BUYUK YIGIN (en cok import EDEN) ===")
for f, c in sorted(outgoing.items(), key=lambda x: -x[1])[:10]:
    print(f"{c:4d}  {f}")

print()
total = len(deps)
isolated = sum(1 for f in deps if outgoing.get(f, 0) == 0 and incoming.get(f, 0) == 0)
leaves = sum(1 for f in deps if outgoing.get(f, 0) == 0 and incoming.get(f, 0) > 0)
sources = sum(1 for f in deps if outgoing.get(f, 0) > 0 and incoming.get(f, 0) == 0)
HUB_THRESHOLD = 10
hubs = sum(1 for f, c in incoming.items() if c >= HUB_THRESHOLD)

print("=== TOPOLOJI ===")
print(f"Toplam modul:  {total}")
print(f"Izole (0/0):   {isolated}")
print(f"Yaprak (kimseyi import etmez ama edilir): {leaves}")
print(f"Koken (kimse import etmez, import eder):  {sources}  (entry points: pages/routes)")
print(f"Hub (>={HUB_THRESHOLD} import alan): {hubs}")


def layer(path):
    if path.startswith("app/api/"):
        return "api"
    if path.startswith("app/admin"):
        return "admin"
    if path.startswith("app/"):
        return "page"
    if path.startswith("components/"):
        return "component"
    if path.startswith("lib/agents/"):
        return "agent"
    if path.startswith("lib/pricing"):
        return "pricing"
    if path.startswith("lib/supabase/"):
        return "supabase"
    if path.startswith("lib/"):
        return "lib"
    if path.startswith("hooks/"):
        return "hook"
    return "other"


layer_count = {}
for f in deps:
    li = layer(f)
    layer_count[li] = layer_count.get(li, 0) + 1

print()
print("=== KATMAN DAGILIMI ===")
for li, c in sorted(layer_count.items(), key=lambda x: -x[1]):
    print(f"{c:4d}  {li}")

print()
print("=== KATMAN-ARASI BAGLANTI (TOP 15) ===")
edges = {}
for f, imports in deps.items():
    fl = layer(f)
    for imp in imports:
        il = layer(imp)
        edges[(fl, il)] = edges.get((fl, il), 0) + 1
print(f'{"FROM":<14}{"TO":<14}{"COUNT":>6}')
print(f'{"-"*32}')
for (fl, il), c in sorted(edges.items(), key=lambda x: -x[1])[:15]:
    print(f"{fl:<14}{il:<14}{c:>6}")

# Mermaid graph: layer-level
print()
print("=== KATMAN MERMAID GRAFI ===")
print("```mermaid")
print("graph LR")
print("    page[\"Müşteri sayfaları<br/>" + str(layer_count.get("page", 0)) + " dosya\"]")
print("    admin[\"Admin paneli<br/>" + str(layer_count.get("admin", 0)) + " dosya\"]")
print("    api[\"API routes<br/>" + str(layer_count.get("api", 0)) + " dosya\"]")
print("    component[\"UI Components<br/>" + str(layer_count.get("component", 0)) + " dosya\"]")
print("    lib[\"Lib helpers<br/>" + str(layer_count.get("lib", 0)) + " dosya\"]")
print("    pricing[\"Pricing engine<br/>" + str(layer_count.get("pricing", 0)) + " dosya\"]")
print("    supabase[\"Supabase client<br/>" + str(layer_count.get("supabase", 0)) + " dosya\"]")
print("    agent[\"Auditor agents<br/>" + str(layer_count.get("agent", 0)) + " dosya\"]")
print("    hook[\"React hooks<br/>" + str(layer_count.get("hook", 0)) + " dosya\"]")

# Sadece anlamlı edge'leri ekle
for (fl, il), c in sorted(edges.items(), key=lambda x: -x[1])[:20]:
    if fl == il or c < 3:
        continue
    print(f"    {fl} -->|{c}| {il}")
print("```")

# Orphans by layer
print()
print("=== ORPHAN (HIC IMPORT EDILMEYEN) — POSSIBLE DEAD CODE ===")
orphan_by_layer = {}
for f in deps:
    if incoming.get(f, 0) == 0 and outgoing.get(f, 0) > 0:
        # entry point degil sadece — pages route auto-discovered
        # Routes/pages app/ altinda auto-load, false positive
        if f.endswith("page.tsx") or f.endswith("layout.tsx") or f.endswith("route.ts"):
            continue
        if f in ("middleware.ts", "instrumentation.ts", "instrumentation-client.ts"):
            continue
        li = layer(f)
        orphan_by_layer.setdefault(li, []).append(f)

total_orphan = sum(len(v) for v in orphan_by_layer.values())
print(f"Toplam {total_orphan} dead code aday (page/layout/route haric):")
for li, files in sorted(orphan_by_layer.items()):
    print(f"\n[{li}]")
    for f in files:
        print(f"  - {f}")
