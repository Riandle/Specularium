"""把迁移下来的语雀原图压缩成 webp，并改掉 Markdown 里的引用。

语雀导出的 PNG 动辄两三兆，20 张就 44 MB，对仓库和构建都不友好。
统一缩到最大宽度 1600px、webp 质量 82，通常能压到原来的十分之一左右。
"""

from __future__ import annotations

import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
IMAGE_DIR = ROOT / "public" / "images" / "imported"
DOC_DIR = ROOT / "src" / "content" / "docs"
MAX_WIDTH = 1600
QUALITY = 82


def optimize(image_path: Path) -> tuple[Path, int, int]:
    before = image_path.stat().st_size
    with Image.open(image_path) as source:
        image = source.convert("RGBA") if source.mode in ("RGBA", "LA", "P") else source.convert("RGB")
        if image.width > MAX_WIDTH:
            height = round(image.height * MAX_WIDTH / image.width)
            image = image.resize((MAX_WIDTH, height), Image.LANCZOS)
        target = image_path.with_suffix(".webp")
        image.save(target, "WEBP", quality=QUALITY, method=6)
    after = target.stat().st_size
    if image_path != target:
        image_path.unlink()
    return target, before, after


def rewrite_references(mapping: dict[str, str]) -> int:
    changed = 0
    for md in DOC_DIR.rglob("*.md"):
        text = md.read_text(encoding="utf-8")
        original = text
        for old, new in mapping.items():
            text = text.replace(old, new)
        if text != original:
            md.write_text(text, encoding="utf-8")
            changed += 1
    return changed


def main() -> None:
    if not IMAGE_DIR.exists():
        print("没有找到图片目录，跳过。")
        return

    mapping: dict[str, str] = {}
    total_before = total_after = 0
    for path in sorted(IMAGE_DIR.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp"}:
            continue
        if path.suffix.lower() == ".webp":
            continue
        target, before, after = optimize(path)
        total_before += before
        total_after += after
        relative_old = "/" + path.relative_to(ROOT / "public").as_posix()
        relative_new = "/" + target.relative_to(ROOT / "public").as_posix()
        mapping[relative_old] = relative_new
        print(f"{path.name}: {before // 1024} KB → {after // 1024} KB")

    updated = rewrite_references(mapping)
    print(f"\n图片 {len(mapping)} 张：{total_before / 1024 / 1024:.1f} MB → {total_after / 1024 / 1024:.1f} MB")
    print(f"改了 {updated} 个 Markdown 文件的图片引用。")


if __name__ == "__main__":
    main()
