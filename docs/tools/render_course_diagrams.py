"""Render course PlantUML with explicit UTF-8 and check visible SVG labels.

Includes the current database overview and all maintained partition diagrams.
"""
from pathlib import Path
import argparse
import os
import re
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
DIAGRAMS = ROOT / 'diagrams'


def source_labels(path):
    text = path.read_text(encoding='utf-8')
    if '\ufffd' in text:
        raise ValueError(f'{path}: replacement character in UTF-8 source')
    labels = []
    if text.startswith('@startdot'):
        labels += [n for n in re.findall(r'^([a-z_]+) \[pos=.*label=<<TABLE', text, re.M) if not n.startswith('diagram_')]
        labels += re.findall(r'^// FIELD \w+\.(\w+) : ', text, re.M)
        labels += re.findall(r'\[xlabel="(F\d{3})"\]', text)
    for line in text.splitlines():
        if line.startswith('title '):
            labels.append(line[6:].strip())
        match = re.match(r'\s*(?:actor|boundary|control|entity|participant|class|usecase|state|rectangle|package)\s+"([^"]+)"', line)
        if match:
            label = re.sub(r'<[^>]*>', '', match[1])
            labels.extend(part.strip() for part in label.split(r'\n') if part.strip())
    return labels


def verify_svg(source, svg):
    root = ET.parse(svg).getroot()
    visible = '\n'.join(''.join(node.itertext()) for node in root.iter() if node.tag.endswith('}text'))
    if 'Syntax Error' in visible or '\ufffd' in visible:
        raise ValueError(f'{svg}: rendered error or replacement character')
    for label in source_labels(source):
        if label not in visible:
            raise ValueError(f'{svg}: missing readable source label {label!r}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--jar', default=os.environ.get('PLANTUML_JAR'), help='Path to plantuml.jar (or set PLANTUML_JAR)')
    parser.add_argument('--scope', choices=['course', 'database', 'all'], default='course')
    parser.add_argument('--java', default='java', help='Java executable')
    parser.add_argument('--graphviz-dot', default=os.environ.get('GRAPHVIZ_DOT'), help='Full Graphviz dot executable (required for fixed-layout DOT poster)')
    parser.add_argument('--audit-only', action='store_true', help='Check existing SVG text without Java or rendering')
    args = parser.parse_args()
    sources = []
    if args.scope in ['course', 'all']:
        sources += sorted(DIAGRAMS.glob('*.puml')) + sorted((DIAGRAMS / 'analysis').glob('*.puml'))
    if args.scope in ['database', 'all']:
        sources += sorted((DIAGRAMS / 'database').glob('*.puml'))
    if args.audit_only:
        for source in sources:
            verify_svg(source, source.with_suffix('.svg'))
            if not source.with_suffix('.png').is_file():
                raise ValueError(f'Missing PNG: {source}')
        print(f'PASS: {len(sources)} diagrams; visible SVG labels match UTF-8 sources; PNG files exist.')
        return
    if not args.jar or not Path(args.jar).is_file():
        parser.error('Provide an existing plantuml.jar using --jar or PLANTUML_JAR.')
    command = [args.java, '-Dfile.encoding=UTF-8', '-DPLANTUML_LIMIT_SIZE=24000', '-jar', str(Path(args.jar).resolve()), '-charset', 'UTF-8']
    regular = [p for p in sources if not p.read_text(encoding='utf-8').startswith('@startdot')]
    dot = [p for p in sources if p not in regular]
    commands = [(command, regular)] if regular else []
    if dot:
        graphviz = args.graphviz_dot or shutil.which('dot')
        if not graphviz or not Path(graphviz).is_file():
            parser.error('The full ERD needs a full Graphviz installation; provide --graphviz-dot <dot executable>.')
        commands.append((command + ['-graphvizdot', str(Path(graphviz).resolve())], dot))
    for renderer, paths in commands:
        subprocess.run(renderer + ['-checkonly'] + [str(p) for p in paths], check=True)
    changed = 0
    with tempfile.TemporaryDirectory(prefix='qcmc-plantuml-') as folder:
        for kind in ['png', 'svg']:
            for renderer, paths in commands:
                subprocess.run(renderer + [f'-t{kind}', '-o', folder] + [str(p) for p in paths], check=True)
        # Validate every render before copying any output back to the project.
        for source in sources:
            verify_svg(source, Path(folder) / (source.stem + '.svg'))
            png = Path(folder) / (source.stem + '.png')
            if not png.is_file() or not png.read_bytes().startswith(b'\x89PNG\r\n\x1a\n'):
                raise ValueError(f'Missing generated PNG: {source}')
        for source in sources:
            for extension in ['.png', '.svg']:
                output = source.with_suffix(extension)
                data = (Path(folder) / output.name).read_bytes()
                if not output.exists() or output.read_bytes() != data:
                    output.write_bytes(data)
                    changed += 1
    print(f'PASS: {len(sources)} diagrams rendered as UTF-8 PNG/SVG; {changed} artifacts updated.')


if __name__ == '__main__':
    main()
