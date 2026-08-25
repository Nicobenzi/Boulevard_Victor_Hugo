"""
Novalis - usine de rendu.
Prend les render_jobs 'queued' dans Supabase, produit la video (voix + musique),
l'upload dans le bucket 'videos' et met a jour le job.
Env requis : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""
import os, sys, re, json, subprocess, tempfile, unicodedata, difflib, wave
from datetime import datetime, timezone, timedelta
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
from supabase import create_client

_URL = os.environ.get("SUPABASE_URL", "")
_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
if not _URL or not _KEY:
    # Une variable definie mais VIDE ne leve pas de KeyError : le client echouait
    # plus loin sur un message obscur. On echoue ici, avec le nom du secret manquant.
    manquants = [n for n, v in (("SUPABASE_URL", _URL), ("SUPABASE_SERVICE_ROLE_KEY", _KEY)) if not v]
    raise SystemExit(f"Secret(s) manquant(s) : {', '.join(manquants)}. "
                     "A definir dans Settings > Secrets and variables > Actions.")
SB = create_client(_URL, _KEY)
W, H = 1080, 1920
FPS = 30
# 2 et non 3 : un rendu prend ~3 min, mais la marge est faible sur les 40 min du workflow
# si l'un d'eux est long (poeme de 1 min 47, source lourde). Mieux vaut deux jobs surs
# qu'un troisieme coupe en plein milieu — qui resterait « running » jusqu'au repechage.
MAX_JOBS = 2
# Niveau de la musique sous la voix (elle-meme a -14 LUFS). Plus le chiffre monte,
# plus la nappe est presente. -21 = elle habille ; -26 = on ne l'entend plus.
MUSIQUE_LUFS = -21

# ---------------- utilitaires ----------------

def sh(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"cmd failed: {' '.join(cmd[:4])}... :: {r.stderr[-800:]}")
    return r

def norm_words(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z ]", " ", s.replace("'", " ")).split()

def ts(sec):
    return f"{int(sec//3600)}:{int(sec%3600//60):02d}:{sec%60:05.2f}"

def cesure(v):
    """Coupe un vers long en 2 lignes, a l'espace le plus proche du milieu."""
    if len(v) <= 30: return v
    mid = len(v) // 2
    spaces = [m.start() for m in re.finditer(" ", v)]
    if not spaces: return v
    cut = min(spaces, key=lambda i: abs(i - mid))
    return v[:cut] + "\\N" + v[cut+1:]

# ---------------- transcription + alignement ----------------

def align_verses(audio_path, verses):
    from faster_whisper import WhisperModel
    model = WhisperModel("small", device="cpu", compute_type="int8")
    segs, _ = model.transcribe(audio_path, language="fr", vad_filter=True, word_timestamps=True)
    words = [(w.start, w.end, w.word.strip()) for s in segs for w in s.words]
    if not words: raise RuntimeError("transcription vide")
    flat, idx = [], []
    for i, (_, _, wtxt) in enumerate(words):
        for t in norm_words(wtxt):
            flat.append(t); idx.append(i)
    pos, result = 0, []
    for v in verses:
        vt = norm_words(v); n = max(len(vt), 1)
        best, bests = (pos, n), -1.0
        for start in range(max(0, pos - 4), min(max(len(flat) - 1, 1), pos + 10)):
            for L in range(max(2, n - 3), n + 4):
                if start + L > len(flat): break
                sc = difflib.SequenceMatcher(None, " ".join(vt), " ".join(flat[start:start+L])).ratio()
                if sc > bests: bests, best = sc, (start, L)
        st, L = best
        t0 = words[idx[min(st, len(idx)-1)]][0]
        t1 = words[idx[min(st + L - 1, len(idx)-1)]][1]
        # On garde aussi les attaques mot a mot : c'est la matiere du style cinetique.
        wi = sorted({idx[k] for k in range(st, min(st + L, len(idx)))})
        onsets = [words[j][0] for j in wi]
        result.append((t0, t1, bests, onsets))
        pos = st + L
    return result

# ---------------- audio ----------------

def make_drone(path, dur):
    SR = 48000
    t = np.arange(int(SR * dur)) / SR
    def voice(freq, lfo_T, phase, harm=(1.0, 0.35, 0.12), detune=0.0015):
        sig = np.zeros_like(t)
        for i, a in enumerate(harm, start=1):
            f = freq * i
            sig += a*np.sin(2*np.pi*f*(1+detune)*t) + a*np.sin(2*np.pi*f*(1-detune)*t + 0.7)
        return sig * (0.55 + 0.45*np.sin(2*np.pi*t/lfo_T + phase))
    L = voice(73.42,19,0.0) + voice(110.0,26,1.9)*0.8 + voice(146.83,33,4.1)*0.55
    Rc = voice(73.42,21,0.9) + voice(110.0,24,3.0)*0.8 + voice(146.83,31,5.3)*0.55
    fenv = np.clip((t-12)/10,0,1)*(0.35+0.30*np.clip((t-(dur-16))/8,0,1))
    L += voice(174.61,29,2.2)*fenv*0.5; Rc += voice(174.61,27,0.4)*fenv*0.5
    ker = np.hanning(180); ker /= ker.sum()
    L = np.convolve(L,ker,"same"); Rc = np.convolve(Rc,ker,"same")
    dd = int(0.21*SR)
    for x in (L,Rc): x[dd:] += 0.38*x[:-dd].copy()
    g = np.clip(t/2,0,1)*np.clip((dur-0.3-t)/4.0,0,1)
    L*=g; Rc*=g
    m = max(np.abs(L).max(), np.abs(Rc).max())
    L, Rc = L/m*0.14, Rc/m*0.14
    data = np.empty(2*len(t), dtype=np.int16)
    data[0::2] = (L*32767).astype(np.int16); data[1::2] = (Rc*32767).astype(np.int16)
    with wave.open(path,"wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())

# ---------------- fonds ----------------

def prep_cover(src, path, tw, th, grain=2.4):
    """Redimensionne en cover-crop centre vers (tw,th), unsharp + grain."""
    im = Image.open(src).convert("RGB")
    r = max(tw/im.width, th/im.height)
    im = im.resize((round(im.width*r), round(im.height*r)), Image.LANCZOS)
    x0, y0 = (im.width-tw)//2, (im.height-th)//2
    im = im.crop((x0, y0, x0+tw, y0+th)).filter(ImageFilter.UnsharpMask(radius=2.0, percent=60, threshold=2))
    a = np.array(im, dtype=np.float32) + np.random.default_rng(3).normal(0, grain, (th, tw, 3))
    Image.fromarray(np.clip(a,0,255).astype(np.uint8)).save(path)

# ————————————————————————————————————————————————————————————————————————
# Etalonnage du metrage de fond.
#
# Le metrage libre (Pexels, Mixkit, Videezy) arrive dans SA palette, pas dans la
# notre : un feu de cheminee est orange sature, une mer est cyan. L'ancien reglage
# (brightness=-0.06, saturation=0.92) etait trop faible pour y changer quoi que ce
# soit — d'ou des fonds qui n'ont jamais eu l'air d'appartenir au meme film.
#
# Cette chaine ramene N'IMPORTE QUELLE source dans la DA, dans cet ordre :
#   1. desaturation forte, sans aller au N&B (on garde une trace de couleur) ;
#   2. assombrissement + contraste : le fond doit rester sous le texte ;
#   3. virage colorimetrique — ombres vers #0e0c0a, hautes lumieres vers l'or ;
#   4. flou : un fond net se bat avec les vers, un fond flou les porte ;
#   5. vignette : ramene l'oeil au centre, assombrit les bords ;
#   6. grain : c'est LUI qui unifie des sources heterogenes en une seule matiere.
#
# Effet recherche : le choix du plan devient secondaire. On prend celui dont le
# MOUVEMENT plait, l'etalonnage fait le reste.
# Pour ajuster, ne toucher qu'ici. Pour comparer avec l'avant : ETALONNAGE = "".
# Valeurs mesurees le 23/08 sur des aplats simulant du metrage reel :
#   braises  #ff7a1a -> #ba8d51   (l'or de la DA est #c9a45c)
#   mer      #2a9dd6 -> #6f836f   (le cyan devient un vert-de-gris chaud)
#   foret    #3fae52 -> #77894d
#   brouillard #bfbfbf -> #c8be9a (la creme de la DA est #ece4d4)
# et surtout, la matiere sombre est PRESERVEE et non ecrasee :
#   #1a1a1a -> #0d0c02, soit exactement le fond #0e0c0a.
# C'est la raison du brightness a -0.03 et non -0.12 : a -0.12 les braises dans la
# nuit tombaient a #000000 et le fond perdait tout mouvement. L'assombrissement sous
# le texte n'est pas le travail de l'etalonnage, c'est celui de make_grad_overlay.
# ⚠ `curves` est la piece maitresse, ajoutee apres un test sur un vrai plan (cascade en foret,
# 23/08). Sans elle, un sujet LUMINEUX ne fait que virer sepia : l'etalonnage teinte au lieu
# d'assombrir, et le texte creme devient illisible sur la moitie haute. Mesure sur ce plan :
# luminance moyenne 121 (brut) -> 88 (sans curves) -> 46 (avec). Sous la bande de texte, le
# contraste avec le creme passe de 3,3:1 a 6,1:1 — le seuil de lisibilite est a 4,5.
# Le flou est a 2,5 et non 5 : a 5 ca lit comme un defaut de mise au point, pas de la profondeur.
ETALONNAGE = (
    "eq=brightness=-0.02:contrast=1.04:saturation=0.24:gamma=1.0,"
    "curves=all='0/0 0.25/0.13 0.5/0.28 0.75/0.42 1/0.55',"
    "colorbalance=rs=0.02:gs=0.00:bs=-0.04:rm=0.10:gm=0.03:bm=-0.10:rh=0.13:gh=0.05:bh=-0.12,"
    "gblur=sigma=2.5,"
    "vignette=PI/4.5,"
    "noise=alls=7:allf=t+u"
)

def build_broll(wd, clips, total, cut=3.2):
    """
    Fond en metrage : des plans qui se relaient toutes les ~3 s, comme le fait
    tout le contenu court qui marche. Les plans sont normalises une fois chacun
    (ils viennent de sources heterogenes), puis enchaines en cycle.
    Renvoie le chemin d'un mp4 de `total` secondes en W x H.
    """
    normes = []
    for i, src in enumerate(clips):
        out = os.path.join(wd, f"broll_{i}.mp4")
        sh(["ffmpeg","-v","error","-y","-i",src,
            "-vf",f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
                  + (ETALONNAGE + "," if ETALONNAGE else "")
                  + f"fps={FPS},setsar=1",
            "-an","-c:v","libx264","-preset","veryfast","-crf","20", out])
        normes.append((out, float(sh(["ffprobe","-v","error","-show_entries","format=duration",
                                      "-of","csv=p=0", out]).stdout.strip() or 0)))
    if not normes: raise RuntimeError("aucun plan de fond exploitable")

    # Liste de segments : on tourne sur les plans, et on avance dans chacun a
    # chaque passage pour ne pas rejouer deux fois la meme seconde.
    lignes, t, i, tetes = [], 0.0, 0, [0.0] * len(normes)
    while t < total:
        chemin, duree = normes[i % len(normes)]
        tete = tetes[i % len(normes)]
        if tete + cut > duree: tete = 0.0
        fin = min(tete + cut, duree)
        lignes.append(f"file '{chemin}'\ninpoint {tete:.2f}\noutpoint {fin:.2f}")
        tetes[i % len(normes)] = fin
        t += (fin - tete); i += 1
        if i > 400: break          # garde-fou

    liste = os.path.join(wd, "broll.txt")
    open(liste, "w").write("ffconcat version 1.0\n" + "\n".join(lignes) + "\n")
    bg = os.path.join(wd, "bg_broll.mp4")
    sh(["ffmpeg","-v","error","-y","-f","concat","-safe","0","-i",liste,
        "-t",f"{total:.2f}","-c:v","libx264","-preset","veryfast","-crf","20",
        "-pix_fmt","yuv420p","-r",str(FPS), bg])
    return bg

def make_grad_overlay(path):
    yy = np.mgrid[0:H,0:W][0].astype(np.float32)/H
    al = np.zeros((H,W),dtype=np.float32)
    s = np.clip((yy-0.66)/0.30,0,1); al += 0.58*s*s*(3-2*s)
    s2 = np.clip((0.16-yy)/0.16,0,1); al += 0.30*s2*s2*(3-2*s2)
    g = np.zeros((H,W,4),dtype=np.uint8); g[...,3] = (al*255).astype(np.uint8)
    Image.fromarray(g).save(path)

def make_galerie_bg(path):
    rng = np.random.default_rng(9)
    yy, xx = np.mgrid[0:H,0:W].astype(np.float32)
    base = np.zeros((H,W,3),dtype=np.float32) + np.array([11,10,9]) + rng.normal(0,2.0,(H,W,1))
    d = np.sqrt(((xx/W)-0.5)**2 + (((yy/H)-0.45)*1.4)**2)
    base *= (1-0.35*np.clip(d-0.35,0,None))[...,None]
    fond = Image.fromarray(np.clip(base,0,255).astype(np.uint8))
    dr = ImageDraw.Draw(fond)
    X0,Y0,X1,Y1 = 160,250,920,1351
    dr.rectangle([X0-7,Y0-7,X1+7,Y1+7], outline=(58,49,38), width=1)
    for i,c in enumerate([(138,116,66),(178,148,88),(138,116,66)]):
        dr.rectangle([X0-3+i,Y0-3+i,X1+3-i,Y1+3-i], outline=c, width=1)
    fond.save(path)

# ---------------- sous-titres ----------------

ASS_HEADER = """[Script Info]
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Verse,{font},{vsize},&H00D9ECF4,&H00FFFFFF,&H96140C08,&H78000000,0,0,0,0,100,100,0,0,1,{voutline},2,2,70,70,{vmargin},1
Style: Title,{font},44,&H00D9ECF4,&H00FFFFFF,&H96140C08,&H78000000,0,0,0,0,100,100,9,0,1,1,2,8,40,40,{tmargin},1
Style: Author,{font},26,&H005CA4C9,&H00FFFFFF,&H96140C08,&H78000000,0,0,0,0,100,100,5,0,1,1,1,8,40,40,{amargin},1
Style: Cap,{font},22,&H005CA4C9,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,4,0,1,0,0,2,40,40,105,1
Style: SigName,{font},62,&H00D9ECF4,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,1,0,1,0,0,5,40,40,0,1
Style: SigSub,{font},30,&H005CA4C9,&H00FFFFFF,&H00000000,&H00000000,0,1,0,0,100,100,3,0,1,0,0,5,40,40,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

ASS_HEADER_CIN = """[Script Info]
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: VType,{font},76,{ink},&H00FFFFFF,&H96140C08,&H78000000,0,0,0,0,100,100,1,0,1,0,0,5,80,80,0,1
Style: VImg,{font},62,{ink},&H00FFFFFF,&H96140C08,&H78000000,0,0,0,0,100,100,0,0,1,3,3,2,70,70,300,1
Style: Title,{font},44,{ink},&H00FFFFFF,&H96140C08,&H78000000,0,0,0,0,100,100,9,0,1,1,2,8,40,40,250,1
Style: Author,{font},26,{gold},&H00FFFFFF,&H96140C08,&H78000000,0,0,0,0,100,100,5,0,1,1,1,8,40,40,332,1
Style: SigName,{font},62,{ink},&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,1,0,1,0,0,5,40,40,0,1
Style: SigSub,{font},30,{gold},&H00FFFFFF,&H00000000,&H00000000,0,1,0,0,100,100,3,0,1,0,0,5,40,40,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

INK_ASS, GOLD_ASS = "&H00D4E4EC", "&H005CA4C9"   # #ece4d4 et #c9a45c, en BGR

def _tokens(v):
    """Decoupe un vers cesure en (mot, saut_de_ligne_avant)."""
    out = []
    for si, seg in enumerate(cesure(v).split("\\N")):
        for wi, w in enumerate(seg.split()):
            out.append((w, si > 0 and wi == 0))
    return out

def _word_times(toks, onsets, v0, v1):
    """
    Attaque de chaque mot affiche. On projette les mots sur les attaques reelles
    de la transcription ; a defaut on repartit au prorata de la longueur des mots.
    """
    n = len(toks)
    if n == 0: return []
    ons = [o for o in onsets if v0 - 0.15 <= o <= v1]
    if len(ons) >= 2:
        m = len(ons)
        t = [ons[min(int(round(j * m / n)), m - 1)] for j in range(n)]
    else:
        wgt = [len(w) + 1 for w, _ in toks]
        tot = sum(wgt) or 1
        span, acc, t = (v1 - v0) * 0.85, 0, []
        for w in wgt:
            t.append(v0 + span * acc / tot); acc += w
    # strictement croissant, et jamais avant le debut du vers
    t[0] = max(t[0], v0)
    for j in range(1, n):
        t[j] = max(t[j], t[j-1] + 0.06)
    return [min(x, v1 - 0.05) if j == n - 1 else x for j, x in enumerate(t)]

def build_ass_cinetique(path, poem, verses, starts, onsets_pv, end_last, total):
    """
    Style cinetique : les mots apparaissent sur la voix, un seul accent or par vers,
    et l'image alterne avec de la typographie sur noir. Renvoie les plages 'sur noir'.
    """
    hdr = ASS_HEADER_CIN.format(font="Cormorant Garamond", ink=INK_ASS, gold=GOLD_ASS)
    ev = [
        f"Dialogue: 0,{ts(0.9)},{ts(6.4)},Title,,0,0,0,,{{\\fad(500,500)}}{poem['title'].upper()}",
        f"Dialogue: 0,{ts(1.2)},{ts(6.4)},Author,,0,0,0,,{{\\fad(500,500)}}{poem['author'].upper()}",
    ]
    # Quatre mouvements d'egale longueur ; les 1er et 3e passent en typographie sur noir.
    n = len(verses)
    bounds = [round(n * k / 4) for k in range(5)]
    groups = [(bounds[k], bounds[k+1] - 1) for k in range(4) if bounds[k+1] > bounds[k]]
    on_black = {i for gi, (a, b) in enumerate(groups) if gi % 2 == 0 for i in range(a, b + 1)}

    for i, v in enumerate(verses):
        v0 = starts[i]
        v1 = starts[i+1] if i + 1 < len(starts) else end_last + 0.3
        toks = _tokens(v)
        if not toks: continue
        tw = _word_times(toks, onsets_pv[i] if i < len(onsets_pv) else [], v0, v1)
        style = "VType" if i in on_black else "VImg"
        gold = max(range(len(toks)), key=lambda j: (len(re.sub(r"[^\w]", "", toks[j][0], flags=re.UNICODE)), j))
        for k in range(len(toks)):
            t0 = tw[k]
            t1 = tw[k+1] if k + 1 < len(toks) else v1
            if t1 - t0 < 0.04: continue
            parts = []
            for j, (w, br) in enumerate(toks[:k+1]):
                piece = (f"{{\\c{GOLD_ASS}&}}{w}{{\\c{INK_ASS}&}}") if j == gold else w
                parts.append(("\\N" + piece) if (br and j > 0) else piece)
            s = parts[0]
            for p in parts[1:]:
                s += p if p.startswith("\\N") else " " + p
            ev.append(f"Dialogue: 0,{ts(t0)},{ts(t1)},{style},,0,0,0,,{s}")

    ev.append(f"Dialogue: 0,{ts(total-3.6)},{ts(total-0.4)},SigName,,0,0,0,,{{\\fad(600,600)\\pos(540,900)}}Novalis")
    ev.append(f"Dialogue: 0,{ts(total-3.3)},{ts(total-0.4)},SigSub,,0,0,0,,{{\\fad(600,600)\\pos(540,1000)}}chaque jour, un poème")
    open(path, "w").write(hdr + "\n".join(ev) + "\n")

    spans = []
    for gi, (a, b) in enumerate(groups):
        if gi % 2: continue
        s0 = starts[a] - 0.2 if a > 0 else 0.0
        s1 = starts[b+1] if b + 1 < len(starts) else end_last + 0.3
        spans.append((max(s0, 0.0), s1))
    spans.append((end_last + 0.3, total))       # la signature de fin reste sur noir
    return spans

def build_ass(path, poem, verses, starts, end_last, total, style):
    galerie = style == "galerie"
    hdr = ASS_HEADER.format(
        font="Cormorant Garamond", vsize=54 if galerie else 58,
        voutline=0 if galerie else 2,
        vmargin=330 if galerie else 350,
        tmargin=92 if galerie else 250, amargin=168 if galerie else 332)
    ev = [
        f"Dialogue: 0,{ts(0.9)},{ts(6.4)},Title,,0,0,0,,{{\\fad(500,500)}}{poem['title'].upper()}",
        f"Dialogue: 0,{ts(1.2)},{ts(6.4)},Author,,0,0,0,,{{\\fad(500,500)}}{poem['author'].upper()}",
    ]
    if galerie and poem.get("source"):
        ev.append(f"Dialogue: 0,{ts(8.0)},{ts(end_last)},Cap,,0,0,0,,{{\\fad(600,600)}}{poem['source'].upper()}")
    for i, (st, v) in enumerate(zip(starts, verses)):
        e = starts[i+1] if i+1 < len(starts) else end_last + 0.3
        ev.append(f"Dialogue: 0,{ts(st)},{ts(e)},Verse,,0,0,0,,{{\\fad(300,300)}}{cesure(v)}")
    ev.append(f"Dialogue: 0,{ts(total-3.6)},{ts(total-0.4)},SigName,,0,0,0,,{{\\fad(600,600)\\pos(540,900)}}Novalis")
    ev.append(f"Dialogue: 0,{ts(total-3.3)},{ts(total-0.4)},SigSub,,0,0,0,,{{\\fad(600,600)\\pos(540,1000)}}chaque jour, un poème")
    open(path, "w").write(hdr + "\n".join(ev) + "\n")

# ---------------- job ----------------

def process_job(job, wd):
    poem = SB.table("poems").select("*").eq("id", job["poem_id"]).single().execute().data
    verses = [l.strip() for l in (poem.get("body") or "").splitlines() if l.strip()]
    if not verses: raise RuntimeError("poems.body vide : colle le texte du poème (un vers par ligne)")

    aud = SB.table("assets").select("*").eq("id", job["audio_asset_id"]).single().execute().data
    raw_audio = os.path.join(wd, "raw_audio")
    open(raw_audio, "wb").write(SB.storage.from_(aud["storage_bucket"]).download(aud["storage_path"]))

    aligned = align_verses(raw_audio, verses)
    cut = max(aligned[0][0] - 0.5, 0.0) if aligned[0][0] > 2.0 else 0.0
    starts = [round(a[0] - cut, 2) for a in aligned]
    end_last = round(aligned[-1][1] - cut, 2)
    total = round(end_last + 4.9, 2)
    onsets_pv = [[round(o - cut, 2) for o in a[3]] for a in aligned]

    voice = os.path.join(wd, "voice.wav")
    sh(["ffmpeg","-v","error","-y","-ss",f"{cut:.2f}","-i",raw_audio,
        "-af","highpass=f=70,afftdn=nf=-28,loudnorm=I=-14:TP=-1.5:LRA=11",
        "-ar","48000","-ac","2",voice])
    # Musique, dans cet ordre depuis le 24/08 :
    #   1. celle choisie au montage (`job.music_asset_id`) ;
    #   2. sinon celle liee au poeme — repli qui fait passer les jobs d'avant la migration ;
    #   3. sinon la nappe generee.
    # Le choix appartient au rendu et non au poeme : un meme morceau ressert pour plusieurs
    # poemes sans etre « pris ». Cf. docs/specs/spec-montage-dans-atelier-2026-08-24.md
    pad = os.path.join(wd, "pad.wav")
    if job.get("music_asset_id"):
        mus = SB.table("assets").select("*").eq("id", job["music_asset_id"]).execute().data
    else:
        mus = SB.table("assets").select("*").eq("poem_id", poem["id"]).eq("kind", "music") \
                .order("created_at").limit(1).execute().data
    if mus:
        src_mus = os.path.join(wd, "src_music")
        open(src_mus, "wb").write(SB.storage.from_(mus[0]["storage_bucket"]).download(mus[0]["storage_path"]))
        # boucle si trop courte, coupe si trop longue. Le niveau est fixe plus bas,
        # au moment du mixage, pour que musique liee et nappe generee suivent la meme regle.
        sh(["ffmpeg","-v","error","-y","-stream_loop","-1","-i",src_mus,
            "-t",f"{total + 0.5:.2f}","-ar","48000","-ac","2",pad])
        print("  musique :", mus[0]["title"])
    else:
        make_drone(pad, total + 0.5)

    # fond
    style = job["style"]; pan = False
    img_path = os.path.join(wd, "art.png")

    # Metrage de fond, dans cet ordre depuis le 24/08 :
    #   1. le plan choisi au montage (`job.broll_asset_id`) — un seul, rejoue en boucle ;
    #   2. sinon les plans lies au poeme — repli pour les jobs d'avant la migration.
    # Recupere AVANT le fond, parce que c'est l'une des deux sources acceptables et que le
    # controle ci-dessous doit les connaitre toutes les deux.
    #
    # Un seul plan ne demande aucun traitement special : `build_broll` avance une tete de
    # lecture par segments contigus dans le clip et repart a zero quand il est epuise.
    # C'est exactement « la meme video tout du long », a une coupe franche pres au raccord.
    brolls = []
    if style == "cinetique":
        if job.get("broll_asset_id"):
            rows = SB.table("assets").select("*").eq("id", job["broll_asset_id"]).execute().data or []
        else:
            rows = SB.table("assets").select("*").eq("poem_id", poem["id"]).eq("kind", "broll") \
                     .order("created_at").execute().data or []
        for i, a in enumerate(rows):
            p = os.path.join(wd, f"src_broll_{i}")
            open(p, "wb").write(SB.storage.from_(a["storage_bucket"]).download(a["storage_path"]))
            brolls.append(p)
        if brolls: print(f"  metrage : {len(brolls)} plan(s)")

    # Pas de fond = pas de video. On echoue franchement plutot que de fabriquer une image
    # de secours : `painterly_bg` produisait une tache pale et centree, par endroits PLUS
    # CLAIRE que le texte creme (luminance jusqu'a 247 pour un creme a 226), et les vers y
    # disparaissaient. Un fond rate publie vaut moins qu'un rendu qui refuse de partir.
    # Le job passe en `error` avec ce message, visible dans l'historique de la fiche du poeme.
    if not job.get("image_asset_id") and not brolls:
        raise RuntimeError(
            "aucun fond : choisis un plan dans « Plan de fond » sur la fiche du poeme avant "
            "de generer. Si tu en avais choisi un, il a ete supprime des Ressources depuis "
            "(la colonne repasse a NULL) — reprends-en un autre.")

    if job.get("image_asset_id"):
        ia = SB.table("assets").select("*").eq("id", job["image_asset_id"]).single().execute().data
        src = os.path.join(wd, "src_img")
        open(src, "wb").write(SB.storage.from_(ia["storage_bucket"]).download(ia["storage_path"]))
        im = Image.open(src)
        if im.width / im.height > 1.2 and style == "musee":
            pan = True
            r = 2000 / im.height
            im2 = im.convert("RGB").resize((round(im.width*r), 2000), Image.LANCZOS)
            im2 = im2.filter(ImageFilter.UnsharpMask(radius=2.0, percent=60, threshold=2))
            a = np.array(im2, dtype=np.float32) + np.random.default_rng(3).normal(0, 2.4, (im2.height, im2.width, 3))
            Image.fromarray(np.clip(a,0,255).astype(np.uint8)).save(img_path)
        elif style == "galerie":
            prep_cover(src, img_path, 850, 1233)
        elif style == "cinetique":
            # On entre dans le tableau : la fenetre ne montre qu'environ 65 % de sa hauteur.
            prep_cover(src, img_path, round(W * 1.55), round(H * 1.55))
        else:
            prep_cover(src, img_path, 1600, 2845)
    # Pas de branche « sinon » : sans image liee, on n'arrive ici qu'en `cinetique` avec du
    # metrage, et c'est le bloc broll plus bas qui fabrique le fond.

    sub = os.path.join(wd, "sub.ass")
    black_spans = []
    if style == "cinetique":
        black_spans = build_ass_cinetique(sub, poem, verses, starts, onsets_pv, end_last, total)
    else:
        build_ass(sub, poem, verses, starts, end_last, total, style)

    frames = int(total * FPS)
    fade = f"fade=t=in:st=0:d=0.6,fade=t=out:st={total-5.1:.2f}:d=1.2:color=black"

    if style == "cinetique" and brolls:
        grad = os.path.join(wd, "grad.png"); make_grad_overlay(grad)
        bg_mp4 = build_broll(wd, brolls, total)
        blk = "+".join(f"between(t,{a:.2f},{b:.2f})" for a, b in black_spans) or "0"
        vf = (f"[0:v]setsar=1[c];[c][1:v]overlay=0:0[o];"
              f"[o]drawbox=x=0:y=0:w=iw:h=ih:color=0x0E0C0A@1:t=fill:enable='{blk}',"
              f"format=yuv420p,{fade},subtitles={sub}[v]")
        in0 = bg_mp4
        second_in_cin = grad
    elif style == "cinetique":
        grad = os.path.join(wd, "grad.png"); make_grad_overlay(grad)
        im = Image.open(img_path); iw, ih = im.width, im.height
        # travelling lateral dans le detail, fenetre calee sur le bas du tableau
        # (c'est la que se trouvent les figures dans la peinture classique)
        x0, x1 = round(0.15*(iw-W)), round(0.75*(iw-W))
        ycrop = round((ih-H)*0.62)
        blk = "+".join(f"between(t,{a:.2f},{b:.2f})" for a, b in black_spans) or "0"
        # loop décode l'image une seule fois et la garde en mémoire. Sans ça, ffmpeg
        # redécode le PNG à chaque frame : ~1,9 img/s au lieu de ~19.
        vf = (f"[0:v]loop=loop={frames-1}:size=1:start=0,fps={FPS},"
              f"crop={W}:{H}:x='{x0}+{x1-x0}*min(t/{end_last:.2f}\\,1)':y={ycrop}[c];"
              f"[c][1:v]overlay=0:0[o];"
              f"[o]drawbox=x=0:y=0:w=iw:h=ih:color=0x0E0C0A@1:t=fill:enable='{blk}',"
              f"format=yuv420p,{fade},subtitles={sub}[v]")
        in0 = img_path
        second_in_cin = grad
    elif style == "galerie":
        gal = os.path.join(wd, "gal.png"); make_galerie_bg(gal)
        vf = (f"[1:v]zoompan=z='1+0.06*on/{frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=754x1096:fps={FPS}[art];"
              f"[0:v][art]overlay=163:253,format=yuv420p,{fade},subtitles={sub}[v]")
        in0 = gal
    elif pan:
        grad = os.path.join(wd, "grad.png"); make_grad_overlay(grad)
        iw = Image.open(img_path).width
        x0, x1 = round(0.18*(iw-W)), round(0.72*(iw-W))
        vf = (f"[0:v]crop={W}:{H}:x='{x0}+{x1-x0}*min(t/{end_last:.2f}\\,1)':y=(in_h-{H})/2[c];"
              f"[c][1:v]overlay=0:0,format=yuv420p,{fade},subtitles={sub}[v]")
        in0 = img_path
    else:
        grad = os.path.join(wd, "grad.png"); make_grad_overlay(grad)
        vf = (f"[0:v]scale=1600:2845,zoompan=z='1+0.085*on/{frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS}[z];"
              f"[z][1:v]overlay=0:0,format=yuv420p,{fade},subtitles={sub}[v]")
        in0 = img_path

    second_in = gal if style == "galerie" else (second_in_cin if style == "cinetique" else grad)
    if style == "cinetique" and brolls:
        # in0 est deja une video de la bonne duree : pas de loop, pas de -t
        inputs = ["-i", in0,
                  "-loop","1","-framerate",str(FPS),"-t",f"{total}","-i", second_in]
    elif style == "cinetique":
        # image sans -loop : c'est le filtre loop qui la repete, après un seul décodage
        inputs = ["-i", in0,
                  "-loop","1","-framerate",str(FPS),"-t",f"{total}","-i", second_in]
    elif style == "galerie":
        inputs = ["-loop","1","-framerate",str(FPS),"-t",f"{total}","-i",in0,
                  "-loop","1","-framerate",str(FPS),"-t",f"{total}","-i",img_path]
    else:
        inputs = ["-loop","1","-framerate",str(FPS),"-t",f"{total}","-i",in0,
                  "-loop","1","-framerate",str(FPS),"-t",f"{total}","-i",second_in]

    # Un seul export, avec musique. La version voix seule ne servait qu'au flux
    # « ajouter un son » de TikTok, inutilise — et elle doublait le stockage.
    #
    # Niveaux (mesures le 23/08) : la nappe generee sort a -29,6 LUFS, la voix a -14,2.
    # Quinze LU d'ecart : on ne l'entend pas. On la remonte a MUSIQUE_LUFS, ~7 LU sous
    # la voix, puis on renormalise le MIX a -14 LUFS / -1,5 dBTP.
    # Le loudnorm final est indispensable : un alimiter ne borne que la crete d'echantillon,
    # et la crete REELLE atteignait 0,0 dBTP — inter-sample clipping a l'encodage AAC.
    out = os.path.join(wd, "musique.mp4")
    af = (f"[2:a]apad=whole_dur={total}[va];"
          f"[3:a]atrim=0:{total},loudnorm=I={MUSIQUE_LUFS}:TP=-6:LRA=11[ma];"
          f"[va][ma]amix=inputs=2:duration=first:normalize=0,"
          f"loudnorm=I=-14:TP=-1.5:LRA=11,afade=t=out:st={total-2.6:.2f}:d=2.4[a]")
    sh(["ffmpeg","-v","error","-y"] + inputs + ["-i", voice, "-i", pad] +
       ["-filter_complex", vf + ";" + af, "-map","[v]","-map","[a]",
        "-c:v","libx264","-crf","19","-preset","veryfast","-c:a","aac","-b:a","160k",
        "-movflags","+faststart","-t",f"{total}", out])
    outs = [("musique", out)]

    slug = re.sub(r"[^a-z0-9]+","-", unicodedata.normalize("NFD", poem["title"].lower()).encode("ascii","ignore").decode())[:40].strip("-")
    video_asset_id = None
    for variant, out in outs:
        path = f"render/{slug}_{job['id'][:8]}_{variant}.mp4"
        SB.storage.from_("videos").upload(path, open(out,"rb").read(), {"content-type": "video/mp4"})
        ins = SB.table("assets").insert({
            "poem_id": poem["id"], "kind": "video",
            "title": f"{poem['title']} — {style}",
            "storage_bucket": "videos", "storage_path": path,
            "mime_type": "video/mp4", "size_bytes": os.path.getsize(out),
            "meta": {"render_job": job["id"], "variant": variant, "style": style},
        }).execute().data
        if variant == "musique": video_asset_id = ins[0]["id"]
    return video_asset_id

def check_font():
    """
    libass retombe silencieusement sur une police de substitution si Cormorant Garamond
    est absente : les videos sortent alors dans une autre fonte que le site, sans erreur.
    On prefere echouer bruyamment.
    """
    r = subprocess.run(["fc-list", ":", "family"], capture_output=True, text=True)
    if "cormorant" not in r.stdout.lower():
        raise RuntimeError(
            "Cormorant Garamond introuvable (fc-list). Le rendu utiliserait une autre "
            "police que le site. Verifie l'etape « Install ffmpeg + fonts » du workflow.")

def repecher_jobs_bloques(heures=1):
    """
    Un job passe en `running` avant le rendu. Si l'execution meurt en cours de route —
    runner tue, timeout GitHub, OOM — le statut reste `running` POUR TOUJOURS : plus rien
    ne le reprend, et le poeme reste bloque en « En rendu » dans l'Atelier sans que
    personne ne comprenne pourquoi.

    On repeche donc tout `running` plus vieux que `heures`. Le seuil est large : un rendu
    prend ~3 min, une heure ne peut pas etre une execution encore vivante.
    """
    limite = (datetime.now(timezone.utc) - timedelta(hours=heures)).isoformat()
    bloques = SB.table("render_jobs").select("id,poem_id,updated_at,created_at") \
        .eq("status", "running").lt("created_at", limite).execute().data
    for j in bloques or []:
        print(f"  repeche job {j['id']} (bloque en running depuis {j['created_at']})")
        SB.table("render_jobs").update({
            "status": "queued",
            "error": "reprise automatique : execution precedente interrompue",
        }).eq("id", j["id"]).execute()
    return len(bloques or [])

def main():
    check_font()
    n = repecher_jobs_bloques()
    if n: print(f"{n} job(s) bloque(s) remis en file")
    jobs = SB.table("render_jobs").select("*").eq("status","queued").order("created_at").limit(MAX_JOBS).execute().data
    if not jobs:
        print("aucun job en attente"); return
    for job in jobs:
        print("job", job["id"], "poem", job["poem_id"], "style", job["style"])
        SB.table("render_jobs").update({"status":"running"}).eq("id", job["id"]).execute()
        try:
            with tempfile.TemporaryDirectory() as wd:
                vid = process_job(job, wd)
            SB.table("render_jobs").update({"status":"done","video_asset_id":vid,"error":None}).eq("id", job["id"]).execute()
            print("  -> done")
        except Exception as e:
            print("  -> error:", e)
            SB.table("render_jobs").update({"status":"error","error":str(e)[:500]}).eq("id", job["id"]).execute()

if __name__ == "__main__":
    main()
