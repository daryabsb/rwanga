# Empty-Line Geometry Probe — Slice B

## PageMap budget (what the engine reserves)
- linesPerPage: 57   (1 PageMap-line = 0.170 in = 16.3 px)
- empty paragraph: 2 lines  → 32.6 px budgeted  (first-on-page: 1)
- text paragraph:  2 lines  → 32.6 px budgeted

## Flow render — RTL
| element | rendered height px | top→next-top gap px |
|---|---|---|
| text1 | 24 | 40 |
| text2 | 24 | 40 |
| empty1 | 24 | 40 |
| empty2 | 24 | 40 |
| empty3 | 24 | 40 |
| marker | 0 | 0 |
| empty4 | 24 | 40 |
| empty5 | 24 | — |

## Flow render — LTR
| element | rendered height px | top→next-top gap px |
|---|---|---|
| text1 | 24 | 40 |
| text2 | 24 | 40 |
| empty1 | 24 | 40 |
| empty2 | 24 | 40 |
| empty3 | 24 | 40 |
| marker | 0 | 0 |
| empty4 | 24 | 40 |
| empty5 | 24 | — |

## Print render
- text print block:  16 px
- empty print block: 0 px

## Read
- empty paragraph renders 24px; PageMap budgets 32.6px → ratio 0.74×
- Flow page-break marker renders 0px; PageMap budgets it 0 (widgets are not normalized blocks)