#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BÜTÜN KOMPONENTLƏRDƏ MƏTNLƏRİ t() İLƏ ƏVƏZ ET (v2)
- import { t } istifadə edir (hook yox) — scope problemi olmur
- JSX >Mətn< → >{t("açar")}<
- toast.x("Mətn") → toast.x(t("açar"))
"""
import os, re, json, sys

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_FILE = os.path.join(PROJECT, "electron", "front", "src", "utils", "translations.json")
COMP_DIR = os.path.join(PROJECT, "electron", "front", "src", "components")

with open(JSON_FILE, 'r', encoding='utf-8') as f:
    data = json.load(f)

az_text_to_key = sorted(
    [(text, key) for key, text in data['az'].items() if len(text) >= 3],
    key=lambda x: -len(x[0])
)

SKIP_DIRS = {'node_modules', 'dist', 'build', '.git', '__pycache__', 'assets'}

def add_t_import(content):
    if 'from "../../hooks/useTranslation"' in content:
        content = re.sub(r"import \{ useTranslation \} from \"../../hooks/useTranslation\";\s*", "", content)
    if 'from "../../utils/translations"' in content:
        return content, False
    import_line = 'import { t } from "../../utils/translations";'
    last_import_end = -1
    for m in re.finditer(r"""from\s+['"][^'"]+['"]\s*;""", content):
        last_import_end = m.end()
    if last_import_end > 0:
        content = content[:last_import_end] + '\n' + import_line + content[last_import_end:]
    else:
        content = import_line + '\n' + content
    return content, True

def replace_jsx_text(content):
    changes = 0
    for az_text, key in az_text_to_key:
        if '/*' in az_text or '*/' in az_text:
            continue
        safe_key = key.replace('\\', '_').strip('_')
        pat = re.compile(rf'(>)\s*{re.escape(az_text)}\s*(<)')
        new_content = pat.sub(lambda m: m.group(1) + '{t("' + safe_key + '")}' + m.group(2), content)
        if new_content != content:
            diff = content.count(az_text) - new_content.count(az_text)
            changes += diff
            content = new_content
    return content, changes

def replace_toast(content):
    changes = 0
    for az_text, key in az_text_to_key:
        safe_key = key.replace('\\', '_').strip('_')
        pat = re.compile(rf'(toast\.\w+\()\s*["\']\s*{re.escape(az_text)}\s*["\']\)')
        new_content = pat.sub(lambda m: m.group(1) + 't("' + safe_key + '"))', content)
        if new_content != content:
            changes += 1
            content = new_content
    return content, changes

def replace_jsx_attrs(content):
    """placeholder, title, alt kimi JSX attributlarinda metnleri evez edir"""
    changes = 0
    for az_text, key in az_text_to_key:
        safe_key = key.replace('\\', '_').strip('_')
        # placeholder="Metn" -> placeholder={t("key")}
        for attr in ['placeholder', 'title', 'alt']:
            pat = re.compile(rf'({attr}=)["\']\s*{re.escape(az_text)}\s*["\']')
            new_content = pat.sub(lambda m: m.group(1) + '{t("' + safe_key + '")}', content)
            if new_content != content:
                changes += 1
                content = new_content
    return content, changes

def replace_label_values(content):
    """JavaScript object-lerdeki label: \"Metni\" -> label: t(\"key\") evez edir"""
    changes = 0
    for az_text, key in az_text_to_key:
        safe_key = key.replace('\\', '_').strip('_')
        # label: "Metn" -> label: t("key")
        pat = re.compile(rf'(label:\s*)["\']\s*{re.escape(az_text)}\s*["\']')
        new_content = pat.sub(lambda m: m.group(1) + 't("' + safe_key + '")', content)
        if new_content != content:
            changes += 1
            content = new_content
    return content, changes

def main():
    sys.stdout = open(sys.stdout.fileno(), 'w', encoding='utf-8', buffering=1)
    print("=" * 50)
    print("  KOMPONENTLƏRDƏ MƏTNLƏRİ t() İLƏ ƏVƏZ ET (v2)")
    print("=" * 50)
    print(f"  {len(az_text_to_key)} açar yukləndi\n")

    total_files = total_jsx = total_toast = total_attr = total_label = 0

    for root, dirs, files in os.walk(COMP_DIR):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in sorted(files):
            if not f.endswith(('.jsx', '.js')): continue
            fp = os.path.join(root, f)
            content = open(fp, 'r', encoding='utf-8', errors='ignore').read()
            orig = content

            # JSX əvəz
            content, jsx_ch = replace_jsx_text(content)
            # Toast əvəz
            content, toast_ch = replace_toast(content)
            # JSX attributlari
            content, attr_ch = replace_jsx_attrs(content)
            # Object label-leri
            content, label_ch = replace_label_values(content)

            if content == orig:
                continue

            # İmport əlavə et
            content, imp_added = add_t_import(content)

            open(fp, 'w', encoding='utf-8') .write(content)
            total_files += 1
            total_jsx += jsx_ch
            total_toast += toast_ch
            total_attr += attr_ch
            total_label += label_ch
            imp = " +import" if imp_added else ""
            parts = []
            if jsx_ch: parts.append(f"JSX:{jsx_ch}")
            if toast_ch: parts.append(f"Tost:{toast_ch}")
            if attr_ch: parts.append(f"Attr:{attr_ch}")
            if label_ch: parts.append(f"Label:{label_ch}")
            detail = " ".join(parts)
            print(f"  [{total_files:2d}] {f:35s} {detail}{imp}")

    print(f"\n{'='*50}")
    print(f"  Yekun: {total_files} fayl, {total_jsx} JSX, {total_toast} Toast, {total_attr} Attr, {total_label} Label")
    print(f"{'='*50}\n")

if __name__ == '__main__':
    main()
