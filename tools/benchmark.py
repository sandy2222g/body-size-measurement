"""Accuracy benchmark for the photo measurement pipeline.

Usage:  python tools/benchmark.py benchmark/ground_truth.csv

CSV columns (cm; tape-measured on the same person as the photo):
    image,height_cm,chest,waist,hips,shoulder_width,arm_length,inseam
`image` is a path relative to the CSV. Needs the real mediapipe stack (Python 3.9-3.11).
Reports per-metric mean absolute error (MAE), bias (mean signed error) and the share of
photos within 3 cm, so accuracy claims can be backed by data.
"""
import csv
import os
import statistics
import sys

METRICS = ['chest', 'waist', 'hips', 'shoulder_width', 'arm_length', 'inseam']


def summarize(errors):
    """errors: {metric: [predicted - truth, ...]} -> {metric: dict}."""
    out = {}
    for m, errs in errors.items():
        if not errs:
            continue
        out[m] = {
            'n': len(errs),
            'mae': statistics.fmean(abs(e) for e in errs),
            'bias': statistics.fmean(errs),
            'within_3cm': sum(abs(e) <= 3 for e in errs) / len(errs),
        }
    return out


def format_report(summary, rejected, total):
    lines = [f'Photos: {total}, rejected by pipeline: {rejected}', '',
             '| metric | n | MAE (cm) | bias (cm) | within 3 cm |', '|---|---|---|---|---|']
    for m in METRICS:
        s = summary.get(m)
        if s:
            lines.append(f"| {m} | {s['n']} | {s['mae']:.1f} | {s['bias']:+.1f} | {s['within_3cm']:.0%} |")
    return '\n'.join(lines)


def run(csv_path):
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    import app as backend  # imported lazily: needs mediapipe

    base = os.path.dirname(os.path.abspath(csv_path))
    errors = {m: [] for m in METRICS}
    rejected = total = 0
    with open(csv_path, newline='') as fh:
        for row in csv.DictReader(fh):
            total += 1
            with open(os.path.join(base, row['image']), 'rb') as img:
                import base64
                payload = 'data:image/jpeg;base64,' + base64.b64encode(img.read()).decode()
            try:
                pred, _ = backend.measure_image(backend.decode_image(payload), float(row['height_cm']))
            except ValueError as exc:
                rejected += 1
                print(f"rejected {row['image']}: {exc}", file=sys.stderr)
                continue
            for m in METRICS:
                if row.get(m):
                    errors[m].append(pred[m] - float(row[m]))
    return format_report(summarize(errors), rejected, total)


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    print(run(sys.argv[1]))
