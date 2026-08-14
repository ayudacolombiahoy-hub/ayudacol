#!/usr/bin/env python3
"""Genera visualizador-focos-v2.html con el mapa real de Vemaps (co-07.svg)."""
import re

SVG_SRC = "/private/tmp/claude-501/-Volumes-Datadriven-02-PROYECTOS-ayuda-humanitaria/2916f363-c081-4a06-b3e3-44bcded05f36/scratchpad/vemaps/co-07.svg"
OUT = "/Volumes/Datadriven/02_PROYECTOS/ayuda humanitaria/.superpowers/brainstorm/26133-1786748400/content/visualizador-focos-v2.html"

svg = open(SVG_SRC, encoding="utf-8").read()
col = re.search(r'<g id="Colombia">(.*?)</g>', svg, re.S).group(1)
path_tags = re.findall(r'<path[^>]*?/>', col, re.S)
assert len(path_tags) == 34, f"esperaba 34 paths, hay {len(path_tags)}"

num = re.compile(r"[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?")

def subpaths(d):
    """Devuelve lista de subpaths como listas de puntos (aprox: endpoints de curvas)."""
    subs, cur = [], []
    cx = cy = sx = sy = 0.0
    tokens = re.findall(r"([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)", d)
    for cmd, args in tokens:
        nums = [float(n) for n in num.findall(args)]
        j = 0
        while True:
            if cmd in "Zz":
                cx, cy = sx, sy
                break
            if j >= len(nums):
                break
            if cmd in "Mm":
                if cmd == "M":
                    cx, cy = nums[j], nums[j + 1]
                else:
                    cx += nums[j]; cy += nums[j + 1]
                j += 2
                sx, sy = cx, cy
                if cur:
                    subs.append(cur)
                cur = [(cx, cy)]
                cmd = "L" if cmd == "M" else "l"
                continue
            elif cmd == "L":
                cx, cy = nums[j], nums[j + 1]; j += 2
            elif cmd == "l":
                cx += nums[j]; cy += nums[j + 1]; j += 2
            elif cmd == "H":
                cx = nums[j]; j += 1
            elif cmd == "h":
                cx += nums[j]; j += 1
            elif cmd == "V":
                cy = nums[j]; j += 1
            elif cmd == "v":
                cy += nums[j]; j += 1
            elif cmd == "C":
                cx, cy = nums[j + 4], nums[j + 5]; j += 6
            elif cmd == "c":
                cx += nums[j + 4]; cy += nums[j + 5]; j += 6
            elif cmd == "S":
                cx, cy = nums[j + 2], nums[j + 3]; j += 4
            elif cmd == "s":
                cx += nums[j + 2]; cy += nums[j + 3]; j += 4
            elif cmd == "Q":
                cx, cy = nums[j + 2], nums[j + 3]; j += 4
            elif cmd == "q":
                cx += nums[j + 2]; cy += nums[j + 3]; j += 4
            elif cmd in "Tt":
                if cmd == "T":
                    cx, cy = nums[j], nums[j + 1]
                else:
                    cx += nums[j]; cy += nums[j + 1]
                j += 2
            elif cmd in "Aa":
                if cmd == "A":
                    cx, cy = nums[j + 5], nums[j + 6]
                else:
                    cx += nums[j + 5]; cy += nums[j + 6]
                j += 7
            cur.append((cx, cy))
    if cur:
        subs.append(cur)
    return subs

def point_in_poly(x, y, poly):
    inside = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            xin = (x2 - x1) * (y - y1) / (y2 - y1) + x1
            if x < xin:
                inside = not inside
    return inside

def path_contains(d, x, y):
    return any(point_in_poly(x, y, sp) for sp in subpaths(d) if len(sp) > 2)

# Calibración equirectangular (anclas: Malpelo y punta oriental de Guainía)
def px(lat, lon):
    x = 178.9 + (lon + 81.6) * 30.24
    y = 322.7 + (4.0 - lat) * 30.05
    return round(x, 1), round(y, 1)

CITIES = {
    "choco": ("Quibdó", 5.69, -76.66),
    "manizales": ("Manizales", 5.07, -75.52),
    "pereira": ("Pereira", 4.81, -75.69),
    "quindio": ("Armenia", 4.53, -75.68),
    "cali": ("Cali", 3.45, -76.53),
}
coords = {k: px(lat, lon) for k, (n, lat, lon) in CITIES.items()}
bog = px(4.71, -74.07)
print("coords:", coords, "bogota:", bog)

# Identificar paths de departamentos afectados por punto-en-polígono
ds = [re.search(r'\sd="([^"]+)"', t).group(1) for t in path_tags]
affected_idx = set()
for k, (x, y) in coords.items():
    hits = [i for i, d in enumerate(ds) if path_contains(d, x, y)]
    print(k, "-> paths", hits)
    affected_idx.update(hits)

# Reconstruir paths: tema oscuro, afectados con clase especial
out_paths = []
for i, t in enumerate(path_tags):
    cls = "dept affected" if i in affected_idx else "dept"
    t2 = re.sub(r'class="[^"]*"', f'class="{cls}"', t)
    out_paths.append(t2)
mapa = "\n".join(out_paths)

foci_meta = {
    "choco":     dict(color="#ef4444", ring="ring", r=7,   label="Chocó",     lx=-8,  ly=-6, anchor="end"),
    "manizales": dict(color="#ef4444", ring="ring", r=7.5, label="Manizales", lx=9,   ly=-4, anchor="start"),
    "pereira":   dict(color="#f59e0b", ring="ringSm", r=5.5, label="Pereira",  lx=-8,  ly=2,  anchor="end"),
    "quindio":   dict(color="#f59e0b", ring="ringSm", r=5,   label="Quindío",  lx=7,   ly=10, anchor="start"),
    "cali":      dict(color="#f59e0b", ring="ring", r=6.5, label="Cali",      lx=-9,  ly=6,  anchor="end"),
}
foci_svg = []
for k, m in foci_meta.items():
    x, y = coords[k]
    foci_svg.append(f'''
      <g class="focus" onclick="showRegion('{k}')">
        <circle class="{m['ring']}" cx="{x}" cy="{y}" r="6" fill="none" stroke="{m['color']}" stroke-width="1.6"/>
        <circle class="{m['ring']}2" cx="{x}" cy="{y}" r="6" fill="none" stroke="{m['color']}" stroke-width="1.6"/>
        <circle class="core" cx="{x}" cy="{y}" r="{m['r']}" fill="{m['color']}" stroke="#020617" stroke-width="1"/>
        <text x="{x + m['lx']}" y="{y + m['ly']}" font-size="9.5" fill="{'#fca5a5' if m['color'] == '#ef4444' else '#fcd34d'}" font-family="system-ui" font-weight="700" text-anchor="{m['anchor']}">{m['label']}</text>
      </g>''')
foci = "\n".join(foci_svg)

html = f"""<style>
  .viz-wrap {{ background:#020617; border-radius:10px; display:flex; flex-wrap:wrap; overflow:hidden; border:1px solid #1e293b; }}
  .viz-map {{ flex:1.25; min-width:330px; position:relative; padding:6px 0 0; }}
  .viz-panel {{ flex:1; min-width:280px; background:#0b1220; border-left:1px solid #1e293b; padding:26px 28px; color:#e2e8f0; font-family:system-ui,sans-serif; }}
  .viz-header {{ position:absolute; top:14px; left:18px; z-index:2; color:#f8fafc; font-family:system-ui,sans-serif; }}
  .viz-header .brand {{ font-size:15px; font-weight:800; letter-spacing:.5px; }}
  .viz-header .live {{ font-size:10px; color:#4ade80; }}
  #mapa-colombia path.dept {{ fill:#0a2440; stroke:#1b4a73; stroke-width:0.6; }}
  #mapa-colombia path.affected {{ fill:#123a63; stroke:#3b82c4; stroke-width:0.9; }}
  .focus {{ cursor:pointer; }}
  .focus circle.core {{ transition:r .2s; }}
  .focus:hover circle.core {{ r:9; }}
  @keyframes ringPulse {{ 0% {{ r:6; opacity:.85; }} 100% {{ r:22; opacity:0; }} }}
  @keyframes ringPulseSm {{ 0% {{ r:5; opacity:.85; }} 100% {{ r:13; opacity:0; }} }}
  .ring {{ animation:ringPulse 2s ease-out infinite; }}
  .ring2 {{ animation:ringPulse 2s ease-out infinite; animation-delay:1s; }}
  .ringSm {{ animation:ringPulseSm 2s ease-out infinite; }}
  .ringSm2 {{ animation:ringPulseSm 2s ease-out infinite; animation-delay:1s; }}
  .big-number {{ font-size:52px; font-weight:800; line-height:1; color:#f8fafc; font-variant-numeric:tabular-nums; }}
  .region-name {{ font-size:18px; font-weight:700; color:#7dd3fc; margin-bottom:14px; }}
  .stat-row {{ display:flex; justify-content:space-between; font-size:13px; padding:7px 0; border-bottom:1px solid #1e293b; }}
  .stat-row b {{ font-variant-numeric:tabular-nums; }}
  .cat-bar {{ height:7px; border-radius:4px; background:#1e293b; margin:3px 0 9px; overflow:hidden; }}
  .cat-bar > div {{ height:100%; border-radius:4px; background:linear-gradient(90deg,#38bdf8,#818cf8); }}
  .cat-label {{ font-size:10.5px; color:#94a3b8; display:flex; justify-content:space-between; }}
  .viz-foot {{ color:#64748b; font-size:10px; padding:8px 18px 10px; font-family:system-ui,sans-serif; display:flex; justify-content:space-between; flex-wrap:wrap; gap:6px; }}
  .viz-foot a {{ color:#7dd3fc; }}
</style>

<h2>Sección 3b (v2): Visualizador de focos con el mapa real</h2>
<p class="subtitle">Silueta oficial de Vemaps con los 33 departamentos · los afectados quedan iluminados · haz clic en los focos</p>

<div class="viz-wrap">
  <div class="viz-map">
    <div class="viz-header">
      <div class="brand">🇨🇴 AyudaCol</div>
      <div class="live">● DATOS EN VIVO · actualizado hace 2 min</div>
    </div>
    <svg id="mapa-colombia" viewBox="245 30 400 555" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">
      <text x="430" y="120" font-size="9" fill="#26435e" font-family="system-ui" letter-spacing="2">MAR CARIBE</text>
      <text x="258" y="330" font-size="9" fill="#26435e" font-family="system-ui" letter-spacing="2" transform="rotate(-70 258 330)">OCÉANO PACÍFICO</text>
{mapa}
      <circle cx="{bog[0]}" cy="{bog[1]}" r="2.6" fill="#64748b"/>
      <text x="{bog[0] + 6}" y="{bog[1] + 3}" font-size="8.5" fill="#64748b" font-family="system-ui">Bogotá</text>
{foci}
    </svg>
  </div>

  <div class="viz-panel">
    <div class="region-name" id="p-name">—</div>
    <div class="big-number" id="p-big">0</div>
    <div style="font-size:12px;color:#94a3b8;margin-bottom:18px;">necesidades activas verificadas</div>
    <div class="stat-row"><span>🔴 Urgentes</span> <b id="p-urgentes" style="color:#f87171">0</b></div>
    <div class="stat-row"><span>📦 Centros de acopio abiertos</span> <b id="p-acopios" style="color:#4ade80">0</b></div>
    <div class="stat-row"><span>🤝 Voluntarios disponibles</span> <b id="p-vols" style="color:#7dd3fc">0</b></div>
    <div class="stat-row" style="margin-bottom:16px"><span>✅ Resueltas esta semana</span> <b id="p-resueltas" style="color:#a3e635">0</b></div>
    <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;font-weight:700;">QUÉ MÁS SE NECESITA AQUÍ</div>
    <div id="p-cats"></div>
    <div style="margin-top:16px"><span style="background:#1d4ed8;color:#dbeafe;border-radius:6px;padding:8px 14px;font-size:12.5px;font-weight:700;cursor:pointer;">Ver detalle y cómo ayudar →</span></div>
  </div>
</div>
<div class="viz-wrap" style="border-top:none;border-radius:0 0 10px 10px;margin-top:-10px;">
  <div class="viz-foot" style="width:100%">
    <span>🔴 crítico &nbsp; 🟡 alto &nbsp;·&nbsp; el pulso del foco = necesidades urgentes sin resolver &nbsp;·&nbsp; departamentos afectados iluminados</span>
    <span>Mapa: © <a href="https://vemaps.com" target="_blank" rel="noopener">Vemaps.com</a></span>
  </div>
</div>

<div class="section" style="margin-top:22px">
  <h3>Así quedaría en el marco elegido (B: portal claro)</h3>
  <p>Este visualizador oscuro va incrustado como pieza central de la página de inicio clara: arriba el titular bilingüe y los botones "Pedir ayuda / Quiero ayudar / Donar desde EE.UU.", y debajo las listas y estadísticas. En producción se conecta a Supabase: el tamaño y color de cada foco se recalculan solos con los datos reales.</p>
</div>

<script>
  var REGIONES = {{
    choco:     {{ name:"Chocó — Quibdó y municipios", activas:96,  urgentes:41, acopios:6,  vols:118, resueltas:22,
                 cats:[["Agua potable",90],["Alimentos",75],["Albergue",60],["Salud",45]] }},
    manizales: {{ name:"Manizales — Caldas", activas:124, urgentes:38, acopios:18, vols:412, resueltas:67,
                 cats:[["Remoción de escombros",85],["Materiales de construcción",70],["Albergue",55],["Alimentos",40]] }},
    pereira:   {{ name:"Pereira — Risaralda", activas:87,  urgentes:21, acopios:14, vols:298, resueltas:54,
                 cats:[["Albergue",80],["Materiales de construcción",65],["Alimentos",50],["Remoción de escombros",45]] }},
    quindio:   {{ name:"Quindío — Armenia y municipios", activas:63,  urgentes:15, acopios:11, vols:187, resueltas:41,
                 cats:[["Materiales de construcción",75],["Albergue",60],["Alimentos",45],["Salud",30]] }},
    cali:      {{ name:"Cali — Valle del Cauca", activas:71,  urgentes:18, acopios:16, vols:390, resueltas:48,
                 cats:[["Alimentos",70],["Albergue",55],["Agua potable",40],["Salud",35]] }}
  }};
  function animateNumber(el, target) {{
    var dur = 600, t0 = performance.now();
    function tick(t) {{
      var p = Math.min((t - t0) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    }}
    requestAnimationFrame(tick);
  }}
  window.showRegion = function(key) {{
    var r = REGIONES[key];
    if (!r) return;
    document.getElementById('p-name').textContent = r.name;
    animateNumber(document.getElementById('p-big'), r.activas);
    animateNumber(document.getElementById('p-urgentes'), r.urgentes);
    animateNumber(document.getElementById('p-acopios'), r.acopios);
    animateNumber(document.getElementById('p-vols'), r.vols);
    animateNumber(document.getElementById('p-resueltas'), r.resueltas);
    var cats = document.getElementById('p-cats');
    cats.innerHTML = '';
    r.cats.forEach(function(c) {{
      var lbl = document.createElement('div'); lbl.className = 'cat-label';
      lbl.innerHTML = '<span>' + c[0] + '</span><span>' + c[1] + '%</span>';
      var bar = document.createElement('div'); bar.className = 'cat-bar';
      var fill = document.createElement('div'); fill.style.width = '0%';
      bar.appendChild(fill); cats.appendChild(lbl); cats.appendChild(bar);
      setTimeout(function() {{ fill.style.transition = 'width .7s ease'; fill.style.width = c[1] + '%'; }}, 60);
    }});
  }};
  showRegion('manizales');
</script>
"""

open(OUT, "w", encoding="utf-8").write(html)
print("OK ->", OUT, len(html), "bytes")
