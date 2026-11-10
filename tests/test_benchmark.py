import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tools'))
import benchmark  # noqa: E402


class BenchmarkStatsTests(unittest.TestCase):
    def test_summarize(self):
        s = benchmark.summarize({'chest': [2.0, -4.0, 1.0], 'waist': []})
        self.assertNotIn('waist', s)
        self.assertAlmostEqual(s['chest']['mae'], 7 / 3)
        self.assertAlmostEqual(s['chest']['bias'], -1 / 3)
        self.assertAlmostEqual(s['chest']['within_3cm'], 2 / 3)

    def test_format_report(self):
        text = benchmark.format_report(benchmark.summarize({'chest': [1.0]}), rejected=1, total=2)
        self.assertIn('rejected by pipeline: 1', text)
        self.assertIn('| chest | 1 | 1.0 | +1.0 | 100% |', text)


if __name__ == '__main__':
    unittest.main()
