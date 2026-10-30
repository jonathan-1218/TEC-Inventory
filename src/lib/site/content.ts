export const pad = (i: number, w = 2) => String(i).padStart(w, "0");

export const manifesto =
  "TEC is The Electronics Club of LICET. A community where students explore skills, bring ideas to life and build projects hands-on, with events, hardware and guidance for competitions. Inspiring the next.";

export const phrases = [
  { range: "0.26,0.44", k: "01 — SIGNAL", a: "EVERY IDEA STARTS", b: "AS A SIGNAL." },
  { range: "0.47,0.6", k: "02 — DECAP", a: "LOOK", b: "CLOSER." },
  { range: "0.62,0.77", k: "03 — SILICON", a: "BILLIONS OF", b: "TINY DECISIONS." },
  { range: "0.8,1.2", k: "04 — TRANSISTOR", a: "ON. OFF.", b: "INSPIRE." },
];

export const visionMission = [
  ["V1", "To create a platform to explore and enhance the skillsets of the students"],
  ["V2", "To create an environment where students are able to bring out their ideas to life"],
  ["V3", "To build a tech community to give first-hand project experience at LICET"],
  ["M1", "To organise community-building events"],
  ["M2", "To create an open forum for discussion and innovation."],
  ["M3", "To give exposure to recent technologies and hardware for up skilling of students"],
  ["M4", "To guide students in projects thereby making them participate in competitions"],
] as const;

export const core = [
  ["President", "Patrick M"],
  ["Secretary", "Subramani Priyanka"],
  ["Treasurer", "Sahana C K"],
  ["Joint Secretary", "Jonathan Jeshua S"],
  ["Technical Head", "Jack Iniyan G"],
  ["Human Resource Manager", "Catherine Infanta M"],
  ["Event coordinator", "Prince L"],
  ["Craftsmanship", "Pradeep S"],
  ["Outreach Manager", "Nakshathra M"],
].map(([role, name], i) => ({ n: pad(i + 1), role, name }));

export type GalleryItem = {
  id: string; src: string; ar: string; tag: string; title: string; year: number;
  vid: boolean; type: string; dur: string; c: string;
};

// Photos from the InterConnect magazines (2024–2026), students at work first. [file, title, tag, year, width, height]
const photos: [string, string, string, number, number, number][] = [
  ["u-lab-team", "Team at the lab table", "Lab", 2026, 892, 1024],
  ["u-scope", "Oscilloscope session", "Workshop", 2026, 1259, 1400],
  ["u-workshop", "Board demo", "Workshop", 2026, 1110, 1400],
  ["u-lab", "Lab session", "Lab", 2026, 1400, 1054],
  ["f-drone-build", "Drone build", "Lab", 2025, 816, 612],
  ["g-slice-work", "Heads down at SLICE", "Symposium", 2025, 857, 528],
  ["m-equipment", "Bench session", "Lab", 2023, 1400, 935],
  ["m-hardware", "Hardware check", "Expo", 2024, 573, 427],
  ["g-eyic-demo", "e-Yantra demo", "Competition", 2026, 1400, 838],
  ["f-sih-demo", "SIH prototype", "Hackathon", 2024, 605, 807],
  ["f-pd-workshop", "Product design workshop", "Workshop", 2024, 807, 605],
  ["g-workshop-matlab", "Simulink & IoT", "Workshop", 2025, 756, 742],
  ["g-vac-embedded", "Embedded IoT course", "Lab", 2026, 1400, 562],
  ["g-vac-cpp", "C++ lab", "Lab", 2026, 1400, 523],
  ["g-vac-vlsi", "VLSI course", "Lab", 2025, 1400, 536],
  ["g-vac-iot", "IoT + GenAI", "Lab", 2025, 1400, 544],
  ["f-vac-lab", "Course lab", "Lab", 2025, 1248, 936],
  ["m-quiz", "Engineers' Day quiz", "Competition", 2023, 1114, 743],
  ["m-lab", "Lab hours", "Lab", 2023, 1114, 743],
  ["f-eyrc-arena", "e-Yantra arena", "Competition", 2025, 644, 1145],
  ["f-braille-next", "Braille Next", "Project", 2025, 640, 427],
  ["f-drone-team", "Drone team", "Workshop", 2025, 816, 612],
  ["g-slice-room", "SLICE event hall", "Symposium", 2025, 857, 528],
  ["g-slice-group", "SLICE 2K25", "Symposium", 2025, 1400, 745],
  ["f-slice24", "SLICE 2K24", "Symposium", 2024, 768, 576],
  ["g-eyic-team", "Team AgriNova", "Competition", 2026, 1400, 797],
  ["g-eyrc-team", "e-Yantra finalists", "Competition", 2026, 1352, 774],
  ["f-eyrc-champions", "e-Yantra champions", "Competition", 2025, 800, 600],
  ["f-sih-team", "Team Carbonites", "Hackathon", 2024, 832, 555],
  ["f-grand-finale", "Grand finale", "Hackathon", 2024, 980, 653],
  ["f-pals-finals", "PALS InnoWAH finals", "Hackathon", 2025, 640, 427],
  ["f-ethglobal", "ETHGlobal", "Hackathon", 2024, 640, 480],
  ["f-design-spark", "Design Spark Challenge", "Hackathon", 2025, 640, 427],
  ["g-sip-1", "Induction day", "Orientation", 2025, 1400, 568],
  ["g-sip-2", "Induction session", "Orientation", 2025, 1400, 557],
  ["f-sip-1", "Induction 2024", "Orientation", 2024, 807, 605],
  ["f-sip-2", "Induction talks", "Orientation", 2024, 807, 605],
  ["f-vac-group", "Course batch", "Lab", 2025, 800, 450],
  ["g-conclave", "Industry conclave", "Talk", 2025, 1400, 526],
  ["g-engineers-day", "Engineers' Day", "Talk", 2025, 831, 805],
  ["g-iv-shar", "SDSC SHAR", "Visit", 2026, 939, 527],
  ["g-iv-narl", "NARL", "Visit", 2026, 914, 519],
  ["g-iv-daikin", "Daikin", "Visit", 2026, 939, 511],
  ["g-iv-lotte", "Lotte India", "Visit", 2026, 914, 552],
  ["g-iv-timf", "TIMF Auto", "Visit", 2026, 939, 494],
  ["g-iv-tidc", "TIDC plant", "Visit", 2026, 914, 494],
  ["g-iv-spacezone", "Space Zone", "Visit", 2026, 914, 511],
  ["f-iv", "Industrial visit", "Visit", 2025, 512, 384],
  ["f-paris", "ICAM Paris", "Exchange", 2025, 512, 384],
  ["g-engenia-stage", "Engenia stage", "Culture", 2025, 1203, 656],
  ["g-engenia-win", "Engenia 2025", "Culture", 2025, 1228, 618],
  ["f-engenia", "Engenia champions", "Culture", 2024, 1210, 681],
  ["g-sports", "Sports Day", "Culture", 2026, 1400, 907],
  ["f-sports", "March past", "Culture", 2025, 832, 624],
];

export const archive: GalleryItem[] = photos.map(([key, title, tag, year, w, h], i) => ({
  id: pad(i + 1, 3), src: `/site/gallery/${key}.webp`, ar: `${w}/${h}`, tag, title, year,
  vid: false, type: "Photo", dur: "", c: i % 3 ? "rgba(242,240,234,.07)" : "rgba(233,151,4,.2)",
}));

/** The three photos fanned out in the homepage gallery teaser. */
export const galleryCards = [
  { label: "SCOPE", rot: -7, src: archive[1].src },
  { label: "LAB", rot: 3, src: archive[0].src },   // the lab-table photo takes the centre
  { label: "WORKSHOP", rot: 9, src: archive[2].src },
];
