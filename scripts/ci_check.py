"""Static checks for CI (no dependencies).
Usage:  python3 scripts/ci_check.py           -> exit 1 on any error
Checks: every local js/css file in index.html exists, every js/*.js is loaded by index.html,
every data/**/*.json|geojson parses, dist/ is up to date with build.py (warning only).
"""
import json, pathlib, re, subprocess, sys, tempfile

root = pathlib.Path(__file__).resolve().parent.parent
errors = []
html = (root / "index.html").read_text(encoding="utf-8")

refs = set(re.findall(r'(?:src|href)="((?:js|css|data)/[^"#?]+)"', html))
for r in sorted(refs):
    if not (root / r).is_file():
        errors.append(f"index.html: {r} does not exist")
for js in sorted((root / "js").glob("*.js")):
    if f"js/{js.name}" not in refs:
        errors.append(f"js/{js.name} is not loaded by index.html")

data = sorted(p for p in (root / "data").rglob("*") if p.suffix in (".json", ".geojson"))
for p in data:
    try:
        json.loads(p.read_text(encoding="utf-8"))
    except (ValueError, UnicodeDecodeError) as e:
        errors.append(f"{p.relative_to(root)}: invalid JSON ({e})")

# dist/ is committed by hand: warn (GitHub annotation) when it no longer matches the sources
dist = root / "dist" / "flood-scenario-explorer.html"
with tempfile.TemporaryDirectory() as tmp:
    for f in ("index.html", "build.py"):
        (pathlib.Path(tmp) / f).write_bytes((root / f).read_bytes())
    for d in ("css", "js"):
        subprocess.run(["cp", "-r", str(root / d), tmp], check=True)
    subprocess.run([sys.executable, "build.py"], cwd=tmp, check=True, capture_output=True)
    if not dist.is_file() or (pathlib.Path(tmp) / "dist" / dist.name).read_bytes() != dist.read_bytes():
        print("::warning file=dist/flood-scenario-explorer.html::dist/ is out of date: run `python build.py` and commit it")

print(f"{len(refs)} files referenced, {len(data)} data files checked")
for e in errors:
    print(f"::error::{e}")
sys.exit(1 if errors else 0)
