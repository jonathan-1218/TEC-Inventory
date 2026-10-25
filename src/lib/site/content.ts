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

// ponytail: placeholder events until real ones exist
export const events = ["WORKSHOP", "HACKATHON", "TALK", "COMPETITION", "EXPO"].map((kind, i) => ({
  code: "EVT-" + pad(i + 1),
  kind,
  name: "Event name",
  desc: "Short description of the event.",
  bg: i % 2 ? "#e99704" : "#f1eee6",
  fg: "#14130f",
}));

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

export const galleryCards = [
  { label: "WORKSHOP", rot: -7 },
  { label: "BUILD NIGHT", rot: 3 },
  { label: "EXPO", rot: 9 },
];

export type GalleryItem = {
  id: string; ar: string; tag: string; title: string; year: number;
  vid: boolean; type: string; dur: string; c: string;
};

const ars = ["4/5", "1/1", "3/4", "16/10", "4/5", "2/3", "16/9", "1/1", "3/4", "4/5", "16/10", "2/3"];
const tags = ["Workshop", "Build night", "Expo", "Hackathon", "Lab", "Team"];
const titles = ["Soldering 101", "Line follower trials", "Tech expo stall", "24h build", "PCB etching", "Vaagi rollout", "Arduino bootcamp", "Drone test day", "IoT demo", "Orientation", "Robo race", "Sensor lab"];

// ponytail: generated archive placeholders; swap for real photos/videos (add a `src`) when the archive exists
export const archive: GalleryItem[] = Array.from({ length: 24 }, (_, i) => {
  const vid = i % 5 === 2;
  return {
    id: pad(i + 1, 3), ar: ars[i % 12], tag: tags[(i * 5) % 6], title: titles[i % 12], year: 2026 - (i % 6),
    vid, type: vid ? "Video" : "Photo", dur: "0" + (1 + (i % 3)) + ":" + pad((i * 17) % 60),
    c: i % 3 ? "rgba(242,240,234,.07)" : "rgba(233,151,4,.2)",
  };
});
