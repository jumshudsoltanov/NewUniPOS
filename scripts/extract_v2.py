#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SÜRƏTLİ TƏRCÜMƏ ÇIXARIŞ SKRİPTİ (v2)
Sətir-sətir skan edir, yalnız AZ xarakteri olan sətirlərə regex tətbiq edir.
"""
import os, re, json, sys, time
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor, as_completed

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCAN_DIR = os.path.join(PROJECT, "electron", "front", "src", "components")
JSON_FILE = os.path.join(PROJECT, "electron", "front", "src", "utils", "translations.json")

AZ_RE = re.compile(r'[əşçğöüıƏŞÇĞÖÜİ]')
LINE_PATTERNS = [
    re.compile(r'>([^<]{3,50})<'),
    re.compile(r"""toast\.\w+\(["']([^"']{3,})["']"""),
    re.compile(r'(?:placeholder|title|alt)="([^"]{2,})"'),
]

def has_az(text):
    return bool(AZ_RE.search(text))

def clean(text):
    text = text.strip().rstrip('\\').strip()
    if len(text) < 3 or len(text) > 200: return None
    if text.count('{') > 3 or text.count('}') > 3: return None
    if text.startswith(('import ','export ','require','module.')): return None
    if not has_az(text): return None
    return text

def text_to_key(text):
    key = text.lower().strip()
    for a, b in [('ə','e'),('ş','s'),('ç','c'),('ğ','g'),('ö','o'),('ü','u'),('ı','i')]:
        key = key.replace(a, b)
    key = re.sub(r'["\'«»!?,;:()\[\]{}.]', '', key)
    key = re.sub(r'[\s\-]+', '_', key).strip('_')
    if not key or len(key) < 2:
        key = 'k_' + str(hash(text) & 0xFFFFFFF)
    return key

def scan_files():
    found = set()
    for root, dirs, files in os.walk(SCAN_DIR):
        dirs[:] = [d for d in dirs if d not in {'node_modules','dist','build','.git','__pycache__','assets'}]
        for f in files:
            if not f.endswith(('.jsx','.js')): continue
            fp = os.path.join(root, f)
            try:
                with open(fp, 'r', encoding='utf-8', errors='ignore') as fh:
                    for line in fh:
                        if not AZ_RE.search(line): continue
                        for pat in LINE_PATTERNS:
                            for m in pat.finditer(line):
                                t = clean(m.group(1))
                                if t: found.add(t)
            except: pass
    return found

def translate_text(text, dest_lang):
    try:
        from deep_translator import GoogleTranslator
        r = GoogleTranslator(source="az", target=dest_lang).translate(text)
        return r
    except:
        return None

def main():
    sys.stdout = open(sys.stdout.fileno(), 'w', encoding='utf-8', buffering=1)

    print("=" * 50)
    print("  SÜRƏTLİ TƏRCÜMƏ ÇIXARIŞI")
    print("=" * 50)

    # Mövcud JSON-u yüklə
    with open(JSON_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    existing_az = set(data['az'].keys())
    existing_az_values = set(data['az'].values())
    print(f"\n  Mövcud: {len(existing_az)} açar")

    # Faylları skan et
    print("  Skan edilir...")
    t0 = time.time()
    found = scan_files()
    print(f"  {len(found)} unikal string tapıldı ({time.time()-t0:.1f}s)\n")

    # Yeni string-ləri tap
    new_texts = sorted([t for t in found if t not in existing_az_values])
    if not new_texts:
        print("  Yeni string yoxdur!")
        return

    print(f"  {len(new_texts)} yeni string:\n")

    # Açarları yarat, AZ əlavə et
    keys_added = []
    for text in new_texts:
        key = text_to_key(text)
        orig = key
        i = 1
        while key in data['az']:
            key = f"{orig}_{i}"
            i += 1
        data['az'][key] = text
        data['en'][key] = ""
        data['ru'][key] = ""
        data['tr'][key] = ""
        keys_added.append((key, text))
        print(f"  [{key}] {text[:60]}")

    # Tərcümə et
    print(f"\n  {len(keys_added)} mətn tərcümə edilir (5 paralel)...")

    completed = [0]
    lock = __import__('threading').Lock()

    def do_translate(key, text, lang):
        r = translate_text(text, lang)
        with lock:
            if r: data[lang][key] = r
            completed[0] += 1
            if completed[0] % 20 == 0:
                print(f"    {completed[0]}/{len(keys_added)*3}")

    with ThreadPoolExecutor(max_workers=5) as ex:
        for key, text in keys_added:
            for lang in ['en','ru','tr']:
                ex.submit(do_translate, key, text, lang)

    # JSON-u yadda saxla
    sorted_data = OrderedDict()
    for lang in ['az','en','ru','tr']:
        sorted_data[lang] = OrderedDict(sorted(data[lang].items()))

    with open(JSON_FILE, 'w', encoding='utf-8') as f:
        json.dump(sorted_data, f, ensure_ascii=False, indent=2)

    print(f"\n  ✓ {len(keys_added)} yeni açar əlavə edildi!")
    print(f"  ✓ Cəmi açar: {len(data['az'])}")
    print(f"  ✓ Fayl: translations.json\n")

if __name__ == '__main__':
    main()
