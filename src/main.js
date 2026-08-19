import "./style.css";
import gsap from "gsap";

const row = document.querySelector(".row");
const items = gsap.utils.toArray(".row__item");

const MAX_GROW = 12;
const MIN_GROW = 0.35;
const DECAY = 0.55;
const MAX_CLIP_Y = 22;
const SIGMA = 0.3;
const SAMPLES = 15;
const RADIUS = 15;

const growSetters = items.map((el) =>
  gsap.quickTo(el, "flexGrow", { duration: 0.45, ease: "power3.out" }),
);

const sizes = items.map(() => ({ left: 0, w: 0, h: 0 }));
function measure() {
  items.forEach((el, i) => {
    const b = el.getBoundingClientRect();
    sizes[i].left = b.left;
    sizes[i].w = b.width;
    sizes[i].h = b.height;
  });
}
measure();

const clips = items.map((el, i) => {
  const img = el.querySelector("img");
  const depths = new Array(SAMPLES + 1).fill(0);

  const apply = () => {
    const { w, h } = sizes[i];
    if (!w || !h) return;
    const r = Math.min(RADIUS, w / 2 - 0.5);
    const f = (n) => n.toFixed(1);

    const yAt = (px) => {
      const u = gsap.utils.clamp(0, SAMPLES, (px / w) * SAMPLES);
      const j = Math.min(Math.floor(u), SAMPLES - 1);
      const t = u - j;
      return ((depths[j] * (1 - t) + depths[j + 1] * t) / 100) * h;
    };

    const pts = [{ x: r, y: yAt(r) }];
    for (let j = 1; j < SAMPLES; j++) {
      const px = (j / SAMPLES) * w;
      if (px > r && px < w - r) pts.push({ x: px, y: yAt(px) });
    }
    pts.push({ x: w - r, y: yAt(w - r) });

    const smooth = (points, my) => {
      let seg = "";
      for (let i = 1; i < points.length - 1; i++) {
        const mx = (points[i].x + points[i + 1].x) / 2;
        const yv = (points[i].y + points[i + 1].y) / 2;
        seg += ` Q ${f(points[i].x)} ${f(my(points[i].y))} ${f(mx)} ${f(my(yv))}`;
      }
      const last = points[points.length - 1];
      return seg + ` L ${f(last.x)} ${f(my(last.y))}`;
    };

    const bot = (yv) => h - yv;
    const rev = [...pts].reverse();
    const tl = pts[0];
    const tr = pts[pts.length - 1];

    let d = `M 0 ${f(tl.y + r)} Q 0 ${f(tl.y)} ${f(tl.x)} ${f(tl.y)}`;
    d += smooth(pts, (yv) => yv);
    d += ` Q ${w} ${f(tr.y)} ${w} ${f(tr.y + r)}`;
    d += ` L ${w} ${f(bot(tr.y) - r)} Q ${w} ${f(bot(tr.y))} ${f(tr.x)} ${f(bot(tr.y))}`;
    d += smooth(rev, bot);
    d += ` Q 0 ${f(bot(tl.y))} 0 ${f(bot(tl.y) - r)} Z`;

    img.style.clipPath = `path("${d}")`;
  };
  apply();

  const setters = depths.map((_, j) =>
    gsap.quickTo(depths, j, {
      duration: 0.45,
      ease: "power3.out",
      onUpdate: apply,
    }),
  );
  return { setters, apply };
});

const clipAt = (x, cursorX, sigma) =>
  MAX_CLIP_Y * (1 - Math.exp(-((x - cursorX) ** 2) / (2 * sigma * sigma)));

let lastX = null;

function update(clientX) {
  const bounds = row.getBoundingClientRect();
  const sigma = bounds.width * SIGMA;

  const ratio = gsap.utils.clamp(
    0,
    0.9999,
    (clientX - bounds.left) / bounds.width,
  );
  const active = Math.floor(ratio * items.length);

  items.forEach((_, i) => {
    const t = Math.pow(DECAY, Math.abs(i - active));
    growSetters[i](MIN_GROW + (MAX_GROW - MIN_GROW) * t);

    clips[i].setters.forEach((set, j) => {
      const px = sizes[i].left + (j / SAMPLES) * sizes[i].w;
      set(clipAt(px, clientX, sigma));
    });
  });
}

row.addEventListener("mousemove", (e) => {
  lastX = e.clientX;
  update(lastX);
});

gsap.ticker.add(() => {
  measure();
  if (lastX !== null) update(lastX);
  clips.forEach((c) => c.apply());
});

window.addEventListener("resize", measure);

row.addEventListener("mouseleave", () => {
  lastX = null;
  growSetters.forEach((set) => set(MIN_GROW));
  clips.forEach((c) => c.setters.forEach((set) => set(0)));
});
