"""Bundle the app into ONE html file (for submission / sharing).
Usage:  python build.py        ->  dist/flood-scenario-explorer.html
"""
import pathlib, re
root = pathlib.Path(__file__).parent
html = (root / "index.html").read_text(encoding="utf-8")
css = (root / "css/style.css").read_text(encoding="utf-8")
html = html.replace('<link rel="stylesheet" href="css/style.css">', "<style>\n" + css + "</style>")
def inline(m):
    code = (root / m.group(1)).read_text(encoding="utf-8")
    return "<script>\n" + code + "\n</script>"
html = re.sub(r'<script src="(js/[^"]+)"></script>', inline, html)
out = root / "dist" / "flood-scenario-explorer.html"
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding="utf-8")
print(f"Built {out}  ({out.stat().st_size/1024:.0f} KB)")
