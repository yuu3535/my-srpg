"""採用プランまとめMarkdownをPDF化する（見出し・表・箇条書き・コード枠・改ページに対応）。"""
import re
import sys
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table,
                                TableStyle)

SRC = Path(sys.argv[1])
OUT = Path(sys.argv[2])

pdfmetrics.registerFont(TTFont("JP", "C:/Windows/Fonts/BIZ-UDGothicR.ttc", subfontIndex=0))
pdfmetrics.registerFont(TTFont("JPB", "C:/Windows/Fonts/BIZ-UDGothicB.ttc", subfontIndex=0))
pdfmetrics.registerFontFamily("JP", normal="JP", bold="JPB")

INK = colors.HexColor("#2B2433")
VIOLET = colors.HexColor("#4A3470")
GOLD = colors.HexColor("#A8864A")
MUTED = colors.HexColor("#6E6578")
ROW_A = colors.HexColor("#F4F1F8")
ROW_B = colors.HexColor("#FBFAFD")
RULE = colors.HexColor("#DDD5E8")
CODE_BG = colors.HexColor("#F6F2EA")

S = {
    "title": ParagraphStyle("title", fontName="JPB", fontSize=19, leading=27, textColor=VIOLET, spaceAfter=4),
    "h2": ParagraphStyle("h2", fontName="JPB", fontSize=13, leading=20, textColor=VIOLET, spaceBefore=14,
                         spaceAfter=7, keepWithNext=True),
    "h3": ParagraphStyle("h3", fontName="JPB", fontSize=10.5, leading=16, textColor=INK, spaceBefore=9,
                         spaceAfter=5, keepWithNext=True),
    "body": ParagraphStyle("body", fontName="JP", fontSize=9, leading=15, textColor=INK, wordWrap="CJK",
                           spaceAfter=6),
    "bullet": ParagraphStyle("bullet", fontName="JP", fontSize=9, leading=14.5, textColor=INK, wordWrap="CJK",
                             leftIndent=11, firstLineIndent=-11, spaceAfter=3.5),
    "cell": ParagraphStyle("cell", fontName="JP", fontSize=8.2, leading=12, textColor=INK, wordWrap="CJK"),
    "cellR": ParagraphStyle("cellR", fontName="JP", fontSize=8.2, leading=12, textColor=INK, alignment=TA_RIGHT),
    "th": ParagraphStyle("th", fontName="JPB", fontSize=8.2, leading=12, textColor=colors.white, wordWrap="CJK"),
    "thR": ParagraphStyle("thR", fontName="JPB", fontSize=8.2, leading=12, textColor=colors.white,
                          alignment=TA_RIGHT),
    "code": ParagraphStyle("code", fontName="JP", fontSize=8.4, leading=13.5, textColor=INK),
}
PAGE_W = A4[0] - 36 * mm


def fmt(text):
    text = escape(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    return re.sub(r"`(.+?)`", r'<font color="#4A3470">\1</font>', text)


def text_len(s):
    return sum(2 if ord(ch) > 0x2E80 else 1 for ch in s)


def make_table(rows, aligns):
    head, body = rows[0], rows[1:]
    n = len(head)
    # 列幅: 文字列の列は内容の幅、数値列は中身（見出し除く）の最大幅で同じ幅にそろえる。
    unit = lambda chars: chars * 4.4 + 12
    num_cols = [i for i in range(n) if aligns[i] == "R"]
    widths = [unit(min(max(text_len(r[i]) for r in rows), 44)) for i in range(n)]
    if num_cols:
        body_need = max(text_len(r[i]) for r in body for i in num_cols)
        for i in num_cols:
            # 中身の最大幅を基準に、見出しは10文字幅まで折り返さずに収める
            widths[i] = unit(max(body_need, min(text_len(head[i]), 10)))
    total = sum(widths)
    if total > PAGE_W:
        # 長い説明文の列（16文字幅超）だけを縮める
        base = unit(16)
        long_cols = [i for i in range(n) if i not in num_cols and widths[i] > base]
        slack = sum(widths[i] - base for i in long_cols)
        excess = total - PAGE_W
        if slack > 0:
            for i in long_cols:
                widths[i] -= excess * (widths[i] - base) / slack
        total = sum(widths)
        if total > PAGE_W:
            widths = [PAGE_W * w / total for w in widths]
    elif total > PAGE_W * 0.7:
        widths = [PAGE_W * w / total for w in widths]
    data = [[Paragraph(fmt(c), S["thR" if aligns[i] == "R" else "th"]) for i, c in enumerate(head)]]
    for r in body:
        data.append([Paragraph(fmt(c), S["cellR" if aligns[i] == "R" else "cell"]) for i, c in enumerate(r)])
    t = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), VIOLET),
        ("LINEBELOW", (0, 0), (-1, 0), 1.2, GOLD),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [ROW_A, ROW_B]),
        ("LINEBELOW", (0, 1), (-1, -1), 0.3, RULE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
    ]))
    return t


def make_code(lines):
    body = "<br/>".join(escape(l).replace(" ", "&nbsp;") for l in lines)
    t = Table([[Paragraph(body, S["code"])]], colWidths=[PAGE_W], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CODE_BG),
        ("LINEBEFORE", (0, 0), (0, -1), 2.2, GOLD),
        ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return t


story = []
lines = SRC.read_text(encoding="utf-8").splitlines()
i = 0
pending_heading = []  # 見出しを直後の表・枠と同じページへ置く
while i < len(lines):
    line = lines[i]
    if not line.strip():
        i += 1
        continue
    if line.strip() == "<!-- pagebreak -->":
        story.append(PageBreak())
        i += 1
        continue
    if line.startswith("```"):
        block = []
        i += 1
        while i < len(lines) and not lines[i].startswith("```"):
            block.append(lines[i])
            i += 1
        i += 1
        story.extend([make_code(block), Spacer(1, 8)])
        continue
    if line.startswith("|"):
        raw = []
        while i < len(lines) and lines[i].startswith("|"):
            raw.append([c.strip() for c in lines[i].strip().strip("|").split("|")])
            i += 1
        sep = raw[1]
        aligns = ["R" if c.endswith(":") else "L" for c in sep]
        rows = [raw[0]] + raw[2:]
        story.extend([make_table(rows, aligns), Spacer(1, 8)])
        continue
    if line.startswith("# "):
        story.append(Paragraph(fmt(line[2:]), S["title"]))
        story.append(Table([[""]], colWidths=[PAGE_W], rowHeights=[2],
                           style=[("LINEABOVE", (0, 0), (-1, -1), 1.4, GOLD)]))
        story.append(Spacer(1, 6))
    elif line.startswith("## "):
        story.append(Paragraph(fmt(line[3:]), S["h2"]))
    elif line.startswith("### "):
        story.append(Paragraph(fmt(line[4:]), S["h3"]))
    elif line.startswith("- "):
        story.append(Paragraph("・" + fmt(line[2:]), S["bullet"]))
    else:
        story.append(Paragraph(fmt(line), S["body"]))
    i += 1


def on_page(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(GOLD)
    canvas.setLineWidth(0.6)
    canvas.line(18 * mm, 13 * mm, A4[0] - 18 * mm, 13 * mm)
    canvas.setFont("JP", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 9 * mm, "自作SRPG　ステータス換算と成長 採用プランまとめ（採用版md v1.4 準拠）")
    canvas.drawRightString(A4[0] - 18 * mm, 9 * mm, f"{doc.page}")
    canvas.restoreState()


doc = SimpleDocTemplate(str(OUT), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm,
                        bottomMargin=19 * mm, title="SRPGステータス換算と成長 採用プランまとめ",
                        author="自作SRPGプロジェクト", subject="採用版md v1.4 の要約")
doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
print("written", OUT)
