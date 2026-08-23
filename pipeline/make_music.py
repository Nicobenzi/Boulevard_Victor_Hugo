"""
Banque de nappes musicales — Boulevard Victor Hugo.

100 % genere : aucun enregistrement, aucun sample, donc aucun risque de reclamation
de droits (voir memory.md). Meme moteur que make_drone() dans render.py, mais decline
en plusieurs tonalites et caracteres.

    python3 pipeline/make_music.py [dossier_sortie] [duree_secondes]

Produit des MP3 a uploader dans la Bibliotheque en type « Bande son », puis a lier
au poeme. render.py utilise la musique liee au poeme si elle existe, sinon il genere
sa nappe par defaut.
"""
import os, sys, wave, subprocess
import numpy as np

SR = 48000

# freqs : fondamentale, quinte, octave, tierce (colore le mode)
BANQUE = [
    ("nappe-re-mineur",  [73.42, 110.00, 146.83, 174.61], False, "grave et solennel — le defaut historique"),
    # La mineur reste dans le meme registre que les autres : une fondamentale a 55 Hz (La1)
    # passe sous ce que reproduit un haut-parleur de telephone. Le caractere vient de la
    # tierce mineure, pas du grave.
    ("nappe-la-mineur",  [110.00, 164.81, 220.00, 261.63], False, "veneneux, tendu — la tierce mord"),
    ("nappe-mi-mineur",  [82.41, 123.47, 164.81, 196.00], False, "clair, moins pesant"),
    ("nappe-sol-mineur", [98.00, 146.83, 196.00, 233.08], False, "ample, presque orchestral"),
    ("nappe-do-majeur",  [65.41, 98.00, 130.81, 164.81],  False, "lumineux — pour les poemes non tragiques"),
    ("pouls-re-mineur",  [73.42, 110.00, 146.83, 174.61], True,  "meme nappe, avec un pouls lent sous le texte"),
]

def nappe(path, dur, freqs, pulse=False, seed=0):
    t = np.arange(int(SR * dur)) / SR

    def voix(freq, lfo_T, phase, harm=(1.0, 0.35, 0.12), detune=0.0015):
        sig = np.zeros_like(t)
        for i, a in enumerate(harm, start=1):
            f = freq * i
            sig += a*np.sin(2*np.pi*f*(1+detune)*t) + a*np.sin(2*np.pi*f*(1-detune)*t + 0.7)
        return sig * (0.55 + 0.45*np.sin(2*np.pi*t/lfo_T + phase))

    f0, f5, f8, f3 = freqs
    L  = voix(f0,19,0.0) + voix(f5,26,1.9)*0.8 + voix(f8,33,4.1)*0.55
    Rc = voix(f0,21,0.9) + voix(f5,24,3.0)*0.8 + voix(f8,31,5.3)*0.55
    # la tierce n'entre qu'apres 12 s et ressort a la fin : c'est elle qui donne la couleur
    fenv = np.clip((t-12)/10,0,1)*(0.35+0.30*np.clip((t-(dur-16))/8,0,1))
    L += voix(f3,29,2.2)*fenv*0.5; Rc += voix(f3,27,0.4)*fenv*0.5

    if pulse:                       # pouls lent, ~40 battements/minute
        p = 0.82 + 0.18*np.clip(np.sin(2*np.pi*t*40/60), 0, None)**2
        L *= p; Rc *= p

    ker = np.hanning(180); ker /= ker.sum()
    L = np.convolve(L,ker,"same"); Rc = np.convolve(Rc,ker,"same")
    dd = int(0.21*SR)
    for x in (L,Rc): x[dd:] += 0.38*x[:-dd].copy()
    g = np.clip(t/2,0,1)*np.clip((dur-0.3-t)/4.0,0,1)
    L*=g; Rc*=g
    m = max(np.abs(L).max(), np.abs(Rc).max(), 1e-9)
    L, Rc = L/m*0.14, Rc/m*0.14

    data = np.empty(2*len(t), dtype=np.int16)
    data[0::2] = (L*32767).astype(np.int16); data[1::2] = (Rc*32767).astype(np.int16)
    with wave.open(path,"wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())

def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "musiques"
    dur = float(sys.argv[2]) if len(sys.argv) > 2 else 120.0
    os.makedirs(out, exist_ok=True)
    for name, freqs, pulse, desc in BANQUE:
        wav = os.path.join(out, name + ".wav")
        mp3 = os.path.join(out, name + ".mp3")
        nappe(wav, dur, freqs, pulse)
        subprocess.run(["ffmpeg","-v","error","-y","-i",wav,"-c:a","libmp3lame","-b:a","160k",mp3], check=True)
        os.remove(wav)
        print(f"{name}.mp3  —  {desc}")
    print(f"\n{len(BANQUE)} nappes de {dur:.0f}s dans {out}/")

if __name__ == "__main__":
    main()
