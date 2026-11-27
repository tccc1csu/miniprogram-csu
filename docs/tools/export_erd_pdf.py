"""Export the PlantUML SVG to one vector PDF sheet with embedded Chinese fonts.

Requires reportlab and svglib. Pass Chinese TrueType fonts when running outside
Windows; the fonts must cover the diagram labels. No raster screenshot is used.
"""
import argparse
from pathlib import Path
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.graphics import renderPDF
from svglib.svglib import svg2rlg

ROOT = Path(__file__).resolve().parents[1]


def export_pdf(svg, output, font, bold_font):
    pdfmetrics.registerFont(TTFont('Microsoft YaHei', str(font), subfontIndex=0))
    pdfmetrics.registerFont(TTFont('Microsoft YaHei-Bold', str(bold_font), subfontIndex=0))
    pdfmetrics.registerFontFamily('Microsoft YaHei', normal='Microsoft YaHei', bold='Microsoft YaHei-Bold',
                                italic='Microsoft YaHei', boldItalic='Microsoft YaHei-Bold')
    drawing = svg2rlg(str(svg))
    if drawing is None:
        raise ValueError('Cannot parse the PlantUML SVG')
    pdf = canvas.Canvas(str(output), pagesize=(drawing.width, drawing.height), pageCompression=1, invariant=1)
    pdf.setTitle('青年传媒中心工作台 · 完整数据库关系图')
    pdf.setAuthor('青年传媒中心工作台')
    pdf.setSubject('38 business tables, 214 columns, 79 foreign keys; generated from runtime migrations')
    renderPDF.draw(drawing, pdf, 0, 0)
    pdf.showPage()
    pdf.save()
    print(f'Exported one vector PDF sheet: {drawing.width:.0f} × {drawing.height:.0f} pt; embedded Chinese fonts.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--svg', type=Path, default=ROOT/'diagrams/database/db-full.svg')
    parser.add_argument('--output', type=Path, default=ROOT/'diagrams/database/db-full.pdf')
    parser.add_argument('--font', type=Path, default=Path('C:/Windows/Fonts/msyh.ttc'))
    parser.add_argument('--bold-font', type=Path, default=Path('C:/Windows/Fonts/msyhbd.ttc'))
    args = parser.parse_args()
    if not args.font.is_file() or not args.bold_font.is_file():
        parser.error('Provide --font and --bold-font paths to Chinese TrueType fonts.')
    export_pdf(args.svg, args.output, args.font, args.bold_font)


if __name__ == '__main__':
    main()
