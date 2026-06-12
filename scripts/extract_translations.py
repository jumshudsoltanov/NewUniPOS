#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
============================================================
  AVTOMATİK TƏRCÜMƏ ÇIXARIŞ SKRİPTİ
  Bütün .jsx / .js fayllarını skan edir, mətnləri tapır,
  Google Translate ilə tərcümə edir və translations.json-a
  avtomatik əlavə edir.

  İstifadə:
    pip install googletrans==4.0.0rc1   (lazım deyil -- fallback işləyir)
    python scripts/extract_translations.py

    Parametrlər:
      --scan-dir    Skan ediləcək qovluq (default: electron/front/src)
      --json-file   translations.json yolu (default: electron/front/src/utils/translations.json)
      --dry-run     Yalnız göstər, faylı dəyişmə
      --verbose     Ətraflı çıxış
============================================================
"""
import os
import re
import json
import sys
import argparse
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

# ================================================================
# KONFİQ
# ================================================================
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))

DEFAULT_SCAN_DIR = os.path.join(PROJECT_ROOT, "electron", "front", "src")
DEFAULT_JSON_FILE = os.path.join(
    PROJECT_ROOT, "electron", "front", "src", "utils", "translations.json"
)

# Azərbaycan/Türk xarakterləri -- əgər string-də bunlar varsa, AZ dilidir
AZ_CHARS = set("əşçğöüıƏŞÇĞÖÜİ")

# Skan zamanı atlanacaq qovluqlar
SKIP_DIRS = {"node_modules", "dist", "build", ".git", "__pycache__", "assets"}

# Regex-lər
RE_JSX_TEXT = re.compile(r">([^<]{2,})<")  # >Mətn<
RE_STRING_LITERAL = re.compile(
    r""""((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'""",
)
RE_TOAST = re.compile(
    r"""toast\.(?:error|success|warning|info)\s*\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')""",
    re.DOTALL,
)
RE_PLACEHOLDER = re.compile(
    r"""placeholder\s*=\s*(?:"([^"]*)"|'([^']*)')"""
)
RE_TITLE = re.compile(
    r"""title\s*=\s*(?:"([^"]*)"|'([^']*)')"""
)
RE_ALT = re.compile(
    r"""alt\s*=\s*(?:"([^"]*)"|'([^']*)')"""
)
RE_ALERT_TEXT = re.compile(
    r"""alert\s*\(\s*(?:"([^"]*)"|'([^']*)')"""
)

# Çıxarılacaq string-lərin minimum uzunluğu
MIN_STRING_LENGTH = 2

# Atlanacaq string-lər (kod artefaktları, CSS, URL, rəqəm və s.)
SKIP_PATTERNS = [
    r"^\d+$",  # sadəcə rəqəm
    r"^\d+\.\d+$",  # onluq
    r"^#[0-9a-fA-F]{3,8}$",  # hex rəng
    r"^rgba?\(",  # CSS rəng
    r"^https?://",  # URL
    r"^\w+\.\w+$",  # fayl adı
    r"^\d{1,2}:\d{2}",  # saat
    r"^[A-Za-z0-9_\-]+$",  # təmiz ASCII identifikator
    r"^\s*$",  # boş
    r"^\.\w+$",  # CSS class selector
    r"^[A-Z_]+$",  # SABIT
    r"^[a-z_][a-z0-9_]*$",  # snake_case
    r"^[a-z]+[A-Z][a-zA-Z]*$",  # camelCase
    r"^(px|rem|em|vh|vw|%|\d+px)$",  # CSS vahid
    r"^[{}]$",  # tək mötərizə
    r"^(az|en|ru|tr)$",  # dil kodları
    r"^\d+x\d+$",  # ölçü (200x300)
]

SKIP_COMPILED = [re.compile(p) for p in SKIP_PATTERNS]

# ================================================================
# STRING AŞKARLAMA
# ================================================================


def is_azerbaijani(text):
    """String-in Azərbaycan dilində olub-olmadığını yoxlayır."""
    # Heç olmasa 1 AZ xarakteri olmalı, YA bir neçə söz + türk xarakteri
    has_az_char = bool(set(text) & AZ_CHARS)
    if has_az_char:
        return True
    # Boş və ya çox qısa string-ləri yoxla
    if len(text) < 4:
        return False
    return False


def should_skip(text):
    """String-in kod artefaktı olub-olmadığını yoxlayır (tərcümə edilməməlidir)."""
    text = text.strip()
    if not text or len(text) < MIN_STRING_LENGTH:
        return True
    # Kod sətirlərini at: çoxlu xüsusi simvol varsa, kod blokudur
    code_indicators = sum(1 for c in text if c in "{}[]();<>")
    if code_indicators > 3:
        return True
    for pattern in SKIP_COMPILED:
        if pattern.match(text):
            return True
    return False


def extract_strings_from_file(filepath):
    """Bir fayldan bütün potensial tərcümə string-lərini çıxarır."""
    strings = set()
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
    except Exception as e:
        print(f"  [X] Oxunamadı: {filepath} -- {e}")
        return strings

    # 1. JSX mətnləri: >Mətn burada< (yalnız təmiz mətn, kod blokları deyil)
    for match in RE_JSX_TEXT.finditer(content):
        text = match.group(1).strip()
        # Kod bloklarını filtrlə: { ilə bitən və ya { ilə başlayanları at
        if text and '{' not in text and '}' not in text and '<' not in text and '>' not in text:
            if text and not should_skip(text) and is_azerbaijani(text):
                strings.add(text)

    # 2. String literalları ("", '', ``) — yalnız qısa, təmiz mətnlər
    for match in RE_STRING_LITERAL.finditer(content):
        text = match.group(1) or match.group(2) or ""
        text = text.strip()
        # String literal 3 dənə {param} dan çoxdursa, koddur
        if text.count('{') > 3:
            continue
        # Sondakı tərs slash-ları təmizlə (escaped quote qalıqları)
        text = text.rstrip('\\').strip()
        # import, export, require kimi kod sətirlərini at
        if re.match(r'^(import|export|require|module|const|let|var|function|class)', text, re.IGNORECASE):
            continue
        if text and not should_skip(text) and is_azerbaijani(text):
            strings.add(text)

    # 3. Toast mesajları
    for match in RE_TOAST.finditer(content):
        text = match.group(1) or match.group(2) or ""
        text = text.strip().rstrip('\\').strip()
        if text and not should_skip(text):
            strings.add(text)

    # 4. Placeholder, title, alt attributları
    for regex in [RE_PLACEHOLDER, RE_TITLE, RE_ALT]:
        for match in regex.finditer(content):
            text = match.group(1) or match.group(2) or ""
            text = text.strip()
            if text and not should_skip(text) and is_azerbaijani(text):
                strings.add(text)

    # 5. alert() mesajları
    for match in RE_ALERT_TEXT.finditer(content):
        text = match.group(1) or match.group(2) or ""
        text = text.strip()
        if text and not should_skip(text) and is_azerbaijani(text):
            strings.add(text)

    return strings


def scan_directory(scan_dir):
    """Bütün .jsx/.js fayllarını skan edir və unikal string-ləri qaytarır."""
    all_strings = set()
    file_count = 0

    print(f"\n  Skan edilir: {scan_dir}\n")

    for root, dirs, files in os.walk(scan_dir):
        # Skip ediləcək qovluqları sil
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

        for file in files:
            if not (file.endswith(".jsx") or file.endswith(".js")):
                continue
            filepath = os.path.join(root, file)
            rel_path = os.path.relpath(filepath, PROJECT_ROOT)

            strings = extract_strings_from_file(filepath)
            if strings:
                file_count += 1
                if len(sys.argv) > 1 and "--verbose" in sys.argv:
                    print(f"  [{file_count}] {rel_path}")
                    for s in sorted(strings):
                        print(f"       • {s}")

            all_strings.update(strings)

    print(f"\n  {file_count} faylda {len(all_strings)} unikal string tapıldı.\n")
    return all_strings


# ================================================================
# AÇAR GENERASİYASI
# ================================================================


def text_to_key(text):
    """Azərbaycan mətnindən snake_case açar yaradır.
    Məs: "Yeni sifariş" → "yeni_sifaris"
         "Çap xətası" → "cap_xetasi"
         "Çeklər" → "cekler"
    """
    # Kiçik hərf
    key = text.lower().strip()
    # AZ xüsusi hərfləri ASCII-yə çevir
    replacements = {
        "ə": "e",
        "ş": "s",
        "ç": "c",
        "ğ": "g",
        "ö": "o",
        "ü": "u",
        "ı": "i",
        "Ə": "E",
        "Ş": "S",
        "Ç": "C",
        "Ğ": "G",
        "Ö": "O",
        "Ü": "U",
        "İ": "I",
    }
    for az_char, ascii_char in replacements.items():
        key = key.replace(az_char, ascii_char)

    # Noqteli vergul, vergul, sual isaresi, nida, iki noqte, noqte -> bos
    key = re.sub(r"""[.;:!?,()\[\]{}\"'«»–—\-]""", "", key)
    # Bosluqlari ve tireleri underscore ile evez et
    key = re.sub(r"[\s\-]+", "_", key)
    # Artıq underscore-ları təmizlə
    key = re.sub(r"_+", "_", key)
    # Başdakı/sondakı underscore-ları sil
    key = key.strip("_")
    # {param} kimi yerləşdiriciləri qoru
    # (əvvəlcədən qorunur -- regex dəyişmir)

    if not key or len(key) < 2:
        # Əgər açar çox qısa oldusa, hash istifadə et
        key = "key_" + str(hash(text) & 0xFFFFFFFF)

    return key


# ================================================================
# TƏRCÜMƏ (Google Translate)
# ================================================================

TRANSLATOR = None


def get_translator():
    """Google Translate API yukleyir (mövcud deyilsa None)."""
    global TRANSLATOR
    if TRANSLATOR is not None:
        return TRANSLATOR
    try:
        from deep_translator import GoogleTranslator
        TRANSLATOR = GoogleTranslator
        print("  [OK] Google Translate yuklendi (deep-translator)\n")
    except ImportError:
        print(
            "  [!] deep-translator tapilmadi.\n"
            "    Quracdirmaq ucun: pip install deep-translator\n"
        )
        TRANSLATOR = False
    return TRANSLATOR


def translate_text(text, dest_lang):
    """Metni hedef dile tercume edir. Ugursuz olarsa None."""
    tr = get_translator()
    if not tr:
        return None
    try:
        result = tr(source="az", target=dest_lang).translate(text)
        if result:
            return result
    except Exception as e:
        print(f"  [X] Tercume xetasi ({dest_lang}): {e}")
    return None

    try:
        result = tr.translate(text, src="az", dest=dest_lang)
        if result and result.text:
            return result.text
    except Exception as e:
        print(f"  [X] Tərcümə xətası ({dest_lang}): {e}")
    return None


# ================================================================
# JSON EMALİ
# ================================================================


def load_translations(json_path):
    """Mövcud translations.json-u yükləyir."""
    if os.path.exists(json_path):
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                return json.load(f, object_pairs_hook=OrderedDict)
        except json.JSONDecodeError as e:
            print(f"  [X] JSON parse xətası: {e}")
            return None
    print("  [X] translations.json tapılmadı!")
    return None


def save_translations(json_path, data):
    """translations.json-u yazır (oxunaqlı formatda)."""
    # Açar-ları əlifba sırası ilə düz
    sorted_data = OrderedDict()
    for lang in ["az", "en", "ru", "tr"]:
        if lang in data:
            sorted_data[lang] = OrderedDict(
                sorted(data[lang].items(), key=lambda x: x[0])
            )

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(sorted_data, f, ensure_ascii=False, indent=2)
    print(f"  ✓ translations.json yeniləndi: {json_path}\n")


# ================================================================
# ƏSAS FUNKSİYA
# ================================================================


def main():
    # Windows console encoding fix
    if sys.platform == "win32":
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(
        description="Avtomatik tərcümə çıxarış skripti",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Nümunələr:
  python scripts/extract_translations.py
  python scripts/extract_translations.py --dry-run
  python scripts/extract_translations.py --verbose
  python scripts/extract_translations.py --scan-dir electron/front/src/components/Header
        """,
    )
    parser.add_argument(
        "--scan-dir",
        default=DEFAULT_SCAN_DIR,
        help=f"Skan qovluğu (default: {DEFAULT_SCAN_DIR})",
    )
    parser.add_argument(
        "--json-file",
        default=DEFAULT_JSON_FILE,
        help=f"JSON yolu (default: {DEFAULT_JSON_FILE})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Yalnız göstər, faylı dəyişmə",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Ətraflı çıxış",
    )
    parser.add_argument(
        "--skip-translate",
        action="store_true",
        help="Tərcümə etmədən yalnız AZ mətnlərini əlavə et (sürətli)",
    )
    parser.add_argument(
        "--threads",
        type=int,
        default=5,
        help="Paralel tərcümə işçi sayı (default: 5)",
    )

    args = parser.parse_args()

    print("=" * 50)
    print("     AVTOMATIK TƏRCÜMƏ ÇIXARIŞ SKRİPTİ")
    print("=" * 50)
    print(f"\n  Skan:     {args.scan_dir}")
    print(f"  JSON:     {args.json_file}")
    print(f"  Dry-run:  {'✓' if args.dry_run else 'x'}")

    # 1. Mövcud tərcümələri yüklə
    print("\n--- Mövcud tərcümələr ---")
    data = load_translations(args.json_file)
    if not data:
        print("  Boş JSON ilə başlayırıq.")
        data = {"az": {}, "en": {}, "ru": {}, "tr": {}}

    existing_az_keys = set(data["az"].values())
    existing_keys = set(data["az"].keys())
    print(f"  Mövcud: {len(existing_keys)} açar")

    # 2. Faylları skan et
    print("--- Faylların skan edilməsi ---")
    found_strings = scan_directory(args.scan_dir)

    if not found_strings:
        print("  Heç bir yeni string tapılmadı!")
        return

    # 3. Yeni string-ləri tap (mövcud olmayanlar)
    print("--- Yeni string-lərin işlənməsi ---")
    new_strings = []
    for text in sorted(found_strings):
        if text not in existing_az_keys:
            new_strings.append(text)

    if not new_strings:
        print("  Bütün string-lər artıq translations.json-da var!")
        print(f"  Cəmi: {len(found_strings)} string, hamısı mövcud.\n")
        return

    print(f"  {len(new_strings)} yeni string tapıldı:\n")

    # 4. Hər yeni string üçün açar yarat, sonra paralel tərcümə et
    # Əvvəlcə bütün açarları yaradıb AZ mətnləri yerləşdir
    keys_to_add = []
    for text in new_strings:
        key = text_to_key(text)
        original_key = key
        suffix = 1
        while key in existing_keys:
            key = f"{original_key}_{suffix}"
            suffix += 1
        existing_keys.add(key)
        data["az"][key] = text
        keys_to_add.append((key, text))
        # Digər dillərə placeholder qoy (tərcümə gələndə dolacaq)
        for lang in ["en", "ru", "tr"]:
            data[lang][key] = ""

    if not args.skip_translate:
        # --- Paralel tərcümə ---
        print(f"  {len(keys_to_add)} metn tercume edilir ({args.threads} paralel isci)...\n")
        print_lock = threading.Lock()
        completed = 0

        def translate_one(key, text, lang):
            try:
                result = translate_text(text, lang)
                return key, lang, result
            except Exception as e:
                return key, lang, None

        with ThreadPoolExecutor(max_workers=args.threads) as executor:
            futures = []
            for key, text in keys_to_add:
                for lang in ["en", "ru", "tr"]:
                    futures.append(executor.submit(translate_one, key, text, lang))

            for future in as_completed(futures):
                try:
                    key, lang, result = future.result()
                    if result:
                        data[lang][key] = result
                    with print_lock:
                        completed += 1
                        if completed % 15 == 0 or completed == len(futures):
                            pct = int(completed / len(futures) * 100)
                            print(f"     Tercume: {completed}/{len(futures)} ({pct}%)")
                except Exception:
                    pass

        # Nəticələri göstər
        print(f"\n  Tercume tamamlandi:\n")
        for i, (key, text) in enumerate(keys_to_add, 1):
            en_val = data["en"].get(key, "")
            ru_val = data["ru"].get(key, "")
            tr_val = data["tr"].get(key, "")
            print(f"  {i:3d}. [{key}]")
            print(f"       AZ: {text}")
            print(f"       EN: {en_val or '(bos)'}")
            if args.verbose:
                print(f"       RU: {ru_val or '(bos)'}")
                print(f"       TR: {tr_val or '(bos)'}")
            print()
    else:
        # Skip translate: AZ text-i placeholder kimi kopyala
        for key, text in keys_to_add:
            for lang in ["en", "ru", "tr"]:
                data[lang][key] = text
        print(f"\n  {len(keys_to_add)} açar əlavə edildi (tərcüməsiz):\n")
        for i, (key, text) in enumerate(keys_to_add, 1):
            print(f"  {i:3d}. [{key}] AZ: {text}")
        print()

    # 5. JSON-u yadda saxla (dry-run deyilsə)
    if not args.dry_run:
        save_translations(args.json_file, data)
        print(f"  ✓ {len(new_strings)} yeni açar əlavə edildi!")
        print(f"  ✓ Cəmi açar sayı: {len(data['az'])}")
    else:
        print("  --- Dry-run: fayl dəyişdirilmədi ---")
        print(f"  {len(new_strings)} açar əlavə ediləcək.")
        print(f"  Cəmi açar sayı: {len(data['az'])} olacaq.\n")

    # 6. Boş tərcümələri göstər
    empty_count = 0
    for lang in ["en", "ru", "tr"]:
        for key, val in data[lang].items():
            if not val:
                empty_count += 1
                if args.verbose:
                    az_val = data["az"].get(key, "?")
                    print(f"  ⏳ [{lang}] {key} → boş (AZ: {az_val})")

    if empty_count > 0:
        print(f"\n  [!] {empty_count} boş tərcümə var. Əl ilə doldurun və ya"
              " pip install googletrans==4.0.0rc1 edib yenidən çalışdırın.\n")

    print("--- Hazır! ---\n")


if __name__ == "__main__":
    main()
