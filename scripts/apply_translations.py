#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BÜTÜN KOMPONENTLƏRDƏ MƏTNLƏRİ t() İLƏ ƏVƏZ ET
- translations.json-dakı bütün AZ mətnləri tapır
- JSX-də >Mətn< → >{t("açar")}< edir
- toast.x("Mətn") → toast.x(t("açar")) edir
- İmport və hook əlavə edir
"""
import os, re, json, sys
from collections import OrderedDict

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_FILE = os.path.join(PROJECT, "electron", "front", "src", "utils", "translations.json")
COMPONENTS_DIR = os.path.join(PROJECT, "electron", "front", "src", "components")

# JSON-u yüklə: AZ mətn -> açar mapping yarat
with open(JSON_FILE, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Uzundan qısaya sırala (əvvəlcə uzun mətnləri əvəz et, qısa qalmasın)
az_text_to_key = sorted(
    [(text, key) for key, text in data['az'].items()],
    key=lambda x: -len(x[0])  # ən uzundan ən qısaya
)

SKIP_DIRS = {'node_modules', 'dist', 'build', '.git', '__pycache__', 'assets'}

def add_import_and_hook(content, rel_path):
    """Fayla import və hook əlavə edir (əgər yoxdursa)."""
    if 'useTranslation' in content:
        return content, False

    import_line = 'import { useTranslation } from "../../hooks/useTranslation";'

    # Multiline import-ları da nəzərə alaraq sonuncu import-u tap
    # Sonuncu "from '...';" və ya 'from "...";' -dən sonra əlavə et
    last_import_end = -1
    for m in re.finditer(r"""from\s+['"][^'"]+['"]\s*;""", content):
        last_import_end = m.end()

    if last_import_end > 0:
        # Sonuncu import-dan sonra yeni sətir əlavə et
        content = content[:last_import_end] + '\n' + import_line + content[last_import_end:]
    else:
        # Import yoxdursa, ən əvvələ əlavə et
        content = import_line + '\n' + content

    # Hook əlavə et
    patterns = [
        (r'(const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*\{)', r'\1\n  const { t } = useTranslation();'),
        (r'(function\s+\w+\s*\([^)]*\)\s*\{)', r'\1\n  const { t } = useTranslation();'),
    ]

    for pat, repl in patterns:
        if re.search(pat, content):
            content = re.sub(pat, repl, content, count=1)
            return content, True

    return content, False


def replace_in_jsx_text(content):
    """JSX-dəki >Mətn< mətnlərini >{t("açar")}< ilə əvəz edir.
    Comment-ləri (/* ... */) və JSX atributlarını (="...") təhlükəsiz atlayır."""
    changes = 0
    for az_text, key in az_text_to_key:
        if len(az_text) < 3:
            continue
        # Comment və JSX atribut daxilindəki mətnləri atla
        if '/*' in az_text or '*/' in az_text:
            continue
        safe_key = key.replace('\\', '_').strip('_')
        # Yalnız >text< formatını əvəz et, amma aşağıdakı halları nəzərə alma:
        # - >{t("key")}< (artıq çevrilmiş)
        # - >Mətn< (çevrilməli)
        pattern = re.compile(rf'(>)\s*{re.escape(az_text)}\s*(<)')

        def repl(m):
            return m.group(1) + '{t("' + safe_key + '")}' + m.group(2)

        new_content = pattern.sub(repl, content)
        if new_content != content:
            changes += content.count(az_text) - new_content.count(az_text)
            content = new_content

    return content, changes


def replace_in_toast(content):
    """toast.x("Mətn") çağırışlarını toast.x(t("açar")) ilə əvəz edir."""
    changes_total = 0
    for az_text, key in az_text_to_key:
        if len(az_text) < 5:
            continue
        safe_key = key.replace('\\', '_').strip('_')

        pat = re.compile(rf'(toast\.\w+\()\s*["\'][^"\']*{re.escape(az_text)}[^"\']*["\']\)')

        def repl(m):
            return m.group(1) + 't("' + safe_key + '"))'

        # Daha sadə yanaşma: one-to-one replace
        # toast.xxx("...AZ_TEXT...") -> toast.xxx(t("key"))
        old = re.compile(rf'(toast\.\w+\()\s*["\']\s*{re.escape(az_text)}\s*["\']\)')

        new_content = old.sub(
            lambda m: m.group(1) + 't("' + safe_key + '"))',
            content
        )

        if new_content != content:
            changes_total += content.count(az_text) - new_content.count(az_text)
            content = new_content

    return content, changes_total


def replace_in_alert(content):
    """alert("Mətn") çağırışlarını alert(t("açar")) ilə əvəz edir."""
    for az_text, key in az_text_to_key:
        if len(az_text) < 5:
            continue
        safe_key = key.replace('\\', '_').strip('_')
        old = re.compile(rf'(alert\()\s*["\']\s*{re.escape(az_text)}\s*["\']\)')
        content = old.sub(
            lambda m: m.group(1) + 't("' + safe_key + '"))',
            content
        )
    return content


def process_file(filepath, rel_path):
    """Bir faylı emal edir."""
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    original = content
    total_jsx_changes = 0
    total_toast_changes = 0

    # JSX text mətnlərini əvəz et
    content, jsx_changes = replace_in_jsx_text(content)
    total_jsx_changes = jsx_changes

    # Toast mesajlarını əvəz et
    content, toast_changes = replace_in_toast(content)
    total_toast_changes = toast_changes

    # Alert mesajlarını əvəz et
    content = replace_in_alert(content)

    # İmport və hook əlavə et (əgər dəyişiklik varsa)
    hook_added = False
    if total_jsx_changes > 0 or total_toast_changes > 0:
        content, hook_added = add_import_and_hook(content, rel_path)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True, total_jsx_changes, total_toast_changes, hook_added

    return False, 0, 0, False


def main():
    sys.stdout = open(sys.stdout.fileno(), 'w', encoding='utf-8', buffering=1)

    print("=" * 50)
    print("  KOMPONENTLƏRDƏ MƏTNLƏRİ t() İLƏ ƏVƏZ ET")
    print("=" * 50)
    print(f"  {len(az_text_to_key)} açar yükləndi\n")

    total_files = 0
    total_jsx = 0
    total_toast = 0
    changed_files = []

    for root, dirs, files in os.walk(COMPONENTS_DIR):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            if not f.endswith(('.jsx', '.js')):
                continue
            if f.endswith('.css'):
                continue

            filepath = os.path.join(root, f)
            rel_path = os.path.relpath(filepath, PROJECT)

            changed, jsx_changes, toast_changes, hook_added = process_file(filepath, rel_path)

            if changed:
                total_files += 1
                total_jsx += jsx_changes
                total_toast += toast_changes
                hook_str = " +hook" if hook_added else ""
                print(f"  [{total_files:2d}] {f:35s} JSX:{jsx_changes:3d} Toast:{toast_changes:2d}{hook_str}")
                changed_files.append(rel_path)

    print(f"\n{'='*50}")
    print(f"  Yekun:")
    print(f"  {total_files} fayl dəyişdirildi")
    print(f"  {total_jsx} JSX mətni əvəz edildi")
    print(f"  {total_toast} toast mətni əvəz edildi")
    print(f"{'='*50}\n")

    # Bəzi faylları göstər
    if changed_files:
        print("  Dəyişdirilən fayllar:")
        for cf in changed_files[:20]:
            print(f"    • {cf}")
        if len(changed_files) > 20:
            print(f"    ... və {len(changed_files) - 20} daha")
    print()

if __name__ == '__main__':
    main()
