import { useId, type SVGProps } from "react"
import { cn } from "@/lib/utils"

// Vector trace of the TEC logo in the source PNG's pixel space (1080×759), so every layer can be animated on its own
// (see components/intro). Blocks: measured rectilinear outlines; the letters are gaps in the outline, so they show
// whatever is behind. Pulse: fitted centre-line; its outline is a mask cut-out, not a colour. PCB: 0/45/90° segments
// + pads, clipped to the C block. Static copy: public/brand/tec-logo.svg.
export const VIEWBOX = { x: 24, y: 154, w: 983, h: 432 }
export const BLOCK_TE =
  "M128 154H684V327H621L594 249H514V322H585V394H514V495H594L620 406H684V586H371V247H354V586H219L223 249H182L170 326H128Z"
export const BLOCK_C = "M699 154H1007V328H934.7L908.5 251H829V499H908L935 407H1007V586H699Z"
export const PULSE = "M36 365.5 176 365 240.5 541 262.5 225.5 323.5 451.5 362 313.5 421 480 460.5 361.5 652 361"
export const PULSE_WIDTH = 23.5
export const HALO_WIDTH = 43.5
/** Where the pulse plugs into the C block's traces. */
export const PCB_ENTRY = [699, 361] as const

/** PCB traces: [x1, y1, x2, y2, strokeWidth]. */
export const TRACES: [number, number, number, number, number][] = [
  [968, 156.5, 993, 156.5, 3.2], [954.5, 169.5, 1004.9, 169.5, 3.2], [958.5, 203, 975.5, 203, 3.2],
  [872.1, 216.5, 995.9, 216.5, 5.5], [845.5, 213.5, 858.4, 213.5, 3.2], [845.5, 217, 858.4, 217, 3.2],
  [867.9, 226.5, 960.5, 226.5, 3.2], [849, 246.5, 975, 246.5, 3.2], [920.5, 274.5, 929.5, 274.5, 3.2],
  [931, 279.5, 965.5, 279.5, 3.2], [771.1, 297.5, 825.9, 297.5, 3.2], [779.5, 307.5, 810.5, 307.5, 3.2],
  [701.1, 312.5, 712.5, 312.5, 3.2], [784.5, 313.5, 800.5, 313.5, 3.2], [991, 318.5, 1004, 318.5, 3.2],
  [701.1, 324.5, 724.5, 324.5, 3.2], [701.1, 332.5, 728.5, 332.5, 8.6], [809.1, 334.5, 825.9, 334.5, 3.2],
  [774, 343.5, 784, 343.5, 3.2], [701.1, 352.5, 826.9, 352.5, 10.7], [701.1, 362.5, 769.9, 362.5, 3.2],
  [701.1, 373.5, 826.9, 373.5, 3.2], [701.1, 386.5, 813.5, 386.5, 5.6], [701.1, 395.5, 811.5, 395.5, 3.2],
  [701.1, 402.5, 726.9, 402.5, 3.2], [701.1, 408.5, 779.5, 408.5, 3.2], [955, 408.5, 968, 408.5, 3.2],
  [701.1, 413.5, 770.5, 413.5, 3.2], [701.1, 424.5, 731.5, 424.5, 3.2], [932.1, 424.5, 984.9, 424.5, 3.2],
  [969.5, 450, 1003.5, 450, 3.2], [943.5, 468.5, 1004.9, 468.5, 3.2], [948.5, 480.5, 1004, 480.5, 3.2],
  [918.1, 501.5, 983.9, 501.5, 3.2], [997, 501.5, 1005, 501.5, 3.2], [959.9, 517.5, 974.5, 517.5, 3.2],
  [979.1, 172.1, 1004.4, 197.4, 3.2], [960.5, 226.5, 975.4, 241.4, 3.2], [913.5, 257, 919.5, 263, 3.2],
  [810.5, 307.5, 821.9, 318.9, 3.2], [800.5, 313.5, 811, 324, 3.2], [813.5, 386.5, 827.4, 400.4, 3.2],
  [811.5, 395.5, 827.4, 411.4, 3.2], [779.5, 408.5, 826.9, 455.9, 3.2], [803.1, 438.1, 817.9, 452.9, 3.2],
  [770.5, 413.5, 820.5, 463.5, 3.2], [752.6, 418.6, 804.5, 470.5, 3.2], [718.5, 424.5, 778.5, 484.5, 3.2],
  [731.5, 424.5, 779.4, 472.4, 3.2], [924.6, 449.6, 943.5, 468.5, 3.2], [820.5, 466.5, 827.9, 473.9, 3.2],
  [918.9, 471.9, 938, 491, 3.2], [914.1, 484.1, 921.9, 491.9, 3.2], [909.6, 495.6, 973.4, 559.4, 3.2],
  [849.1, 501.1, 906.9, 558.9, 3.2], [869.1, 502.1, 949.4, 582.4, 3.2], [902.9, 500.9, 958.1, 556.1, 3.2],
  [993.6, 510.6, 1004.9, 521.9, 3.2], [974.5, 517.5, 1004.9, 547.9, 3.2], [980.6, 571.6, 993.4, 584.4, 3.2],
  [845.5, 156, 845.5, 217, 3.2], [870.5, 155.5, 870.5, 181.5, 3.2], [759, 195.5, 759, 233.5, 3.2],
  [739.5, 200.5, 739.5, 250.5, 3.2], [809.5, 219.5, 809.5, 247.5, 3.2], [791.5, 235.1, 791.5, 267.9, 3.2],
  [820.5, 466.5, 820.5, 583.5, 3.2], [804.5, 470.5, 804.5, 583.1, 3.2], [778.5, 484.5, 778.5, 583, 3.2],
  [787, 489.5, 787, 583.5, 3.2], [838, 501.5, 838, 582.5, 3.2], [860.5, 515, 860.5, 538, 3.2],
  [882.5, 539.5, 882.5, 564.5, 3.2], [972.5, 573.1, 972.5, 583.9, 3.2], [783.4, 156.6, 739.5, 200.5, 3.2],
  [797.6, 156.9, 759, 195.5, 3.2], [902.4, 158.6, 728.5, 332.5, 3.2], [928.4, 155.6, 915.1, 168.9, 3.2],
  [826.4, 163.6, 739.5, 250.5, 3.2], [938.9, 161.1, 920.1, 179.9, 3.2], [907.4, 168.6, 868.1, 207.9, 3.2],
  [954.5, 169.5, 913.1, 210.9, 3.2], [912.9, 179.1, 881.1, 210.9, 3.2], [781.4, 226.6, 706.5, 301.5, 3.2],
  [1004.4, 240.6, 965.5, 279.5, 3.2], [739.4, 258.6, 703.1, 294.9, 3.2], [766.9, 258.1, 712.5, 312.5, 3.2],
  [826.7, 262.3, 795.8, 293.2, 3.2], [826.9, 277.1, 810.1, 293.9, 3.2], [987.9, 277.1, 938.6, 326.4, 3.2],
  [989.9, 282.1, 945.1, 326.9, 3.2], [759.4, 289.6, 724.5, 324.5, 3.2], [1001.4, 304.6, 978.1, 327.9, 3.2],
  [779.5, 307.5, 740.4, 346.6, 3.2], [784.5, 313.5, 753, 345, 3.2], [948.5, 480.5, 938, 491, 3.2],
]

/** PCB pads: [cx, cy, r]. */
export const PADS: [number, number, number][] = [
  [948.5, 156.2, 7.8], [809.8, 209.9, 6.8], [865.5, 215, 4.8], [859, 225.1, 6.2], [840.3, 245.1, 6],
  [982, 245.5, 4.8], [770.8, 249.2, 6.8], [764.5, 281.1, 6.8], [1001, 280, 4.8], [941.2, 295.1, 6.4],
  [799.7, 333.1, 6.4], [960.5, 450.5, 6.8], [785.4, 480.4, 6.8], [990.5, 503.5, 4.8], [951, 516.9, 6.6],
  [860.3, 547.7, 6.4], [963.2, 565.1, 7.2], [975, 566.5, 5], [883.7, 573, 6.2],
]

export const tracePath = ([x1, y1, x2, y2]: readonly number[]) => `M${x1} ${y1}L${x2} ${y2}`

// The static logo draws all traces of one width as a single path.
const TRACE_GROUPS = Object.entries(
  TRACES.reduce<Record<number, string>>((acc, t) => ({ ...acc, [t[4]]: (acc[t[4]] ?? "") + tracePath(t) }), {}),
)

/** The mask that cuts the pulse's outline out of the blocks, and the clip that keeps the PCB inside the C. */
export function LogoDefs({ id, halo }: { id: string; halo?: SVGProps<SVGPathElement> }) {
  const { x, y, w, h } = VIEWBOX
  return (
    <defs>
      <mask id={`${id}h`} maskUnits="userSpaceOnUse" x={x} y={y} width={w} height={h}>
        <rect x={x} y={y} width={w} height={h} fill="#fff" />
        <path
          d={PULSE}
          fill="none"
          stroke="#000"
          strokeWidth={HALO_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          {...halo}
        />
      </mask>
      <clipPath id={`${id}c`}>
        <path d={BLOCK_C} />
      </clipPath>
    </defs>
  )
}

/** Blocks use currentColor (solid ink in light, paper in dark by default — override with a text-* class); orange is the brand token. */
export function TecLogo({ height, className }: { height: number; className?: string }) {
  const id = useId()
  const { x, y, w, h } = VIEWBOX
  const width = Math.round((height * w) / h)
  return (
    <svg
      data-tec-logo=""
      viewBox={`${x} ${y} ${w} ${h}`}
      height={height}
      width={width}
      // Inline size so parent rules like `[&_svg]:size-4` (sidebar menu buttons) can't shrink it.
      style={{ width, height }}
      role="img"
      aria-label="TEC"
      className={cn("text-foreground shrink-0", className)}
    >
      <title>TEC</title>
      <LogoDefs id={id} />
      <path d={BLOCK_TE + BLOCK_C} fill="currentColor" mask={`url(#${id}h)`} />
      <g clipPath={`url(#${id}c)`} className="fill-(--logo-trace) stroke-(--logo-trace)" strokeLinecap="round">
        {TRACE_GROUPS.map(([sw, d]) => (
          <path key={sw} d={d} fill="none" strokeWidth={sw} />
        ))}
        {PADS.map(([cx, cy, r]) => (
          <circle key={`${cx},${cy}`} cx={cx} cy={cy} r={r} stroke="none" />
        ))}
      </g>
      <path
        d={PULSE}
        fill="none"
        className="stroke-brand"
        strokeWidth={PULSE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
