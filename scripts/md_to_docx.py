"""把 _local 下的 Markdown 转成排好版的 Word 文档。

支持：标题、段落、加粗/斜体/行内代码（可嵌套）、有序/无序列表、表格、
代码块、引用、提示框（:::note 等）、链接。不做全量 Markdown 兼容——够内部文档用。
"""

from __future__ import annotations

import re
from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

BODY_FONT = "Microsoft YaHei"
CODE_FONT = "Consolas"
ACCENT = RGBColor(0x2F, 0x6B, 0x58)
MUTED = RGBColor(0x5A, 0x5A, 0x5A)
TEXT = RGBColor(0x22, 0x22, 0x22)

ADMONITION_LABELS = {
    "note": "说明",
    "tip": "建议",
    "caution": "注意",
    "danger": "警告",
    "info": "说明",
}

INLINE_RE = re.compile(r"(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))")
LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")


def set_east_asian_font(run, name: str) -> None:
    """python-docx 只设 font.name 时中文可能不生效，需要显式写 eastAsia。"""
    run.font.name = name
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.append(rfonts)
    rfonts.set(qn("w:eastAsia"), name)
    rfonts.set(qn("w:ascii"), name)
    rfonts.set(qn("w:hAnsi"), name)


def add_run(paragraph, text, *, font=BODY_FONT, size=None, bold=False, italic=False, color=None, underline=False):
    run = paragraph.add_run(text)
    run.bold = bold
    run.italic = italic
    run.underline = underline
    set_east_asian_font(run, font)
    if size is not None:
        run.font.size = size
    run.font.color.rgb = color or TEXT
    return run


def shade(paragraph, hex_color: str) -> None:
    ppr = paragraph._p.get_or_add_pPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color)
    ppr.append(shd)


def shade_cell(cell, hex_color: str) -> None:
    tcpr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color)
    tcpr.append(shd)


def add_inline(paragraph, text: str, *, bold=False, italic=False, muted=False) -> None:
    """递归解析行内标记，允许加粗里套行内代码这类写法。"""
    for token in INLINE_RE.split(text):
        if not token:
            continue
        if token.startswith("**") and token.endswith("**") and len(token) > 4:
            add_inline(paragraph, token[2:-2], bold=True, italic=italic, muted=muted)
        elif token.startswith("*") and token.endswith("*") and len(token) > 2:
            add_inline(paragraph, token[1:-1], bold=bold, italic=True, muted=muted)
        elif token.startswith("`") and token.endswith("`") and len(token) > 2:
            add_run(
                paragraph,
                token[1:-1],
                font=CODE_FONT,
                size=Pt(9.5),
                bold=bold,
                italic=italic,
                color=MUTED if muted else ACCENT,
            )
        elif token.startswith("[") and "](" in token:
            match = LINK_RE.match(token)
            if match:
                label, url = match.group(1), match.group(2)
                add_run(paragraph, label, bold=bold, italic=italic, color=MUTED if muted else ACCENT, underline=True)
                if url != label:
                    add_run(paragraph, f"（{url}）", size=Pt(9), color=MUTED)
            else:
                add_run(paragraph, token, bold=bold, italic=italic, color=MUTED if muted else None)
        else:
            add_run(paragraph, token, bold=bold, italic=italic, color=MUTED if muted else None)


def add_heading(doc, text: str, level: int) -> None:
    sizes = {1: 22, 2: 16, 3: 13, 4: 11.5}
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.space_before = Pt(14 if level <= 2 else 10)
    paragraph.paragraph_format.space_after = Pt(6)
    paragraph.paragraph_format.keep_with_next = level <= 2
    add_run(
        paragraph,
        text,
        size=Pt(sizes.get(level, 11)),
        bold=True,
        color=ACCENT if level <= 2 else TEXT,
    )


def add_body(doc, text: str) -> None:
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.space_after = Pt(6)
    paragraph.paragraph_format.line_spacing = 1.4
    add_inline(paragraph, text)


def add_quote(doc, text: str) -> None:
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.left_indent = Cm(0.6)
    paragraph.paragraph_format.space_after = Pt(6)
    add_inline(paragraph, text, italic=True, muted=True)


def add_list_item(doc, text: str, number: int | None, level: int) -> None:
    if number is not None:
        # 有序列表手动写序号：Word 的自动编号会跨列表连续，第二段列表会变成 5.6.7.
        paragraph = doc.add_paragraph()
        paragraph.paragraph_format.left_indent = Cm(0.75 + 0.6 * level)
        paragraph.paragraph_format.first_line_indent = Cm(-0.75)
        paragraph.paragraph_format.space_after = Pt(3)
        add_run(paragraph, f"{number}. ")
        add_inline(paragraph, text)
        return

    style = "List Bullet" if level == 0 else "List Bullet 2"
    try:
        paragraph = doc.add_paragraph(style=style)
    except KeyError:
        paragraph = doc.add_paragraph(style="List Bullet")
    paragraph.paragraph_format.space_after = Pt(3)
    add_inline(paragraph, text)


def add_code_block(doc, lines: list[str]) -> None:
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.left_indent = Cm(0.4)
    paragraph.paragraph_format.space_before = Pt(4)
    paragraph.paragraph_format.space_after = Pt(8)
    paragraph.paragraph_format.line_spacing = 1.1
    shade(paragraph, "F2F4F3")
    add_run(paragraph, "\n".join(lines), font=CODE_FONT, size=Pt(9))


def add_table(doc, rows: list[list[str]]) -> None:
    if not rows:
        return
    columns = max(len(row) for row in rows)
    table = doc.add_table(rows=len(rows), cols=columns)
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    for row_index, row in enumerate(rows):
        for column_index in range(columns):
            cell = table.cell(row_index, column_index)
            text = row[column_index] if column_index < len(row) else ""
            cell.text = ""
            paragraph = cell.paragraphs[0]
            paragraph.paragraph_format.space_after = Pt(2)
            add_inline(paragraph, text, bold=row_index == 0)
            if row_index == 0:
                shade_cell(cell, "E8F1ED")
    doc.add_paragraph()


def split_row(line: str) -> list[str]:
    """按未转义、且不在行内代码里的竖线切分表格行。"""
    text = line.strip()
    if text.startswith("|"):
        text = text[1:]
    if text.endswith("|") and not text.endswith("\\|"):
        text = text[:-1]

    cells: list[str] = []
    current: list[str] = []
    in_code = False
    index = 0
    while index < len(text):
        char = text[index]
        if char == "\\" and index + 1 < len(text):
            current.append(text[index : index + 2])
            index += 2
            continue
        if char == "`":
            in_code = not in_code
            current.append(char)
            index += 1
            continue
        if char == "|" and not in_code:
            cells.append("".join(current).strip())
            current = []
            index += 1
            continue
        current.append(char)
        index += 1
    cells.append("".join(current).strip())
    return [cell.replace("\\|", "|") for cell in cells]


def is_separator_row(line: str) -> bool:
    return bool(re.fullmatch(r"\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?", line.strip()))


def convert(markdown_path: Path, docx_path: Path) -> None:
    lines = markdown_path.read_text(encoding="utf-8").splitlines()

    if lines and lines[0].strip() == "---":
        for index in range(1, len(lines)):
            if lines[index].strip() == "---":
                lines = lines[index + 1 :]
                break

    doc = Document()
    section = doc.sections[0]
    section.page_height = Cm(29.7)
    section.page_width = Cm(21)
    section.left_margin = Cm(2.2)
    section.right_margin = Cm(2.2)
    section.top_margin = Cm(2.2)
    section.bottom_margin = Cm(2.2)

    normal = doc.styles["Normal"]
    normal.font.name = BODY_FONT
    normal.font.size = Pt(10.5)
    normal.element.rPr.rFonts.set(qn("w:eastAsia"), BODY_FONT)

    index = 0
    total = len(lines)
    while index < total:
        line = lines[index]
        stripped = line.strip()

        # 代码块：开围栏的反引号数量决定何时收尾（内层 ```js 这类视为内容）
        fence = re.match(r"^(`{3,})\s*[^\s`]*\s*$", stripped)
        if fence:
            marker = fence.group(1)
            closer = re.compile(r"^`{%d,}\s*$" % len(marker))
            index += 1
            block: list[str] = []
            while index < total and not closer.match(lines[index].strip()):
                block.append(lines[index])
                index += 1
            index += 1
            add_code_block(doc, block)
            continue

        if not stripped:
            index += 1
            continue

        if stripped.startswith("|") and index + 1 < total and is_separator_row(lines[index + 1]):
            rows = [split_row(stripped)]
            index += 2
            while index < total and lines[index].strip().startswith("|"):
                rows.append(split_row(lines[index].strip()))
                index += 1
            add_table(doc, rows)
            continue

        if stripped.startswith(":::"):
            kind = stripped[3:].strip().strip("[]")
            kind = kind.split("[")[0].strip() or "note"
            label = ADMONITION_LABELS.get(kind, "说明")
            index += 1
            block = []
            while index < total and not lines[index].strip().startswith(":::"):
                if lines[index].strip():
                    block.append(lines[index].strip())
                index += 1
            index += 1
            paragraph = doc.add_paragraph()
            paragraph.paragraph_format.left_indent = Cm(0.5)
            paragraph.paragraph_format.space_after = Pt(6)
            shade(paragraph, "EEF5F1")
            add_run(paragraph, f"{label}：", bold=True, color=ACCENT)
            add_inline(paragraph, " ".join(block))
            continue

        heading = re.match(r"^(#{1,4})\s+(.*)$", stripped)
        if heading:
            add_heading(doc, heading.group(2).strip(), len(heading.group(1)))
            index += 1
            continue

        if re.fullmatch(r"(-{3,}|\*{3,})", stripped):
            index += 1
            continue

        if stripped.startswith(">"):
            add_quote(doc, stripped.lstrip(">").strip())
            index += 1
            continue

        bullet = re.match(r"^(\s*)[-*]\s+(.*)$", line)
        ordered = re.match(r"^(\s*)(\d+)\.\s+(.*)$", line)
        if bullet or ordered:
            match = bullet or ordered
            level = 1 if len(match.group(1)) >= 2 else 0
            if ordered:
                add_list_item(doc, ordered.group(3).strip(), int(ordered.group(2)), level)
            else:
                add_list_item(doc, bullet.group(2).strip(), None, level)
            index += 1
            continue

        add_body(doc, stripped)
        index += 1

    doc.core_properties.title = markdown_path.stem
    doc.save(docx_path)


if __name__ == "__main__":
    for source in [Path("_local/开始写作.md"), Path("_local/Markdown语法速查.md")]:
        if not source.exists():
            print(f"跳过（不存在）：{source}")
            continue
        output = source.with_suffix(".docx")
        convert(source, output)
        print(f"已生成：{output}")
