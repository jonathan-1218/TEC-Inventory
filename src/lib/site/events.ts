// Events from the ECE department magazine "InterConnect": Vol 9 (2024), Vol 10 (2025) and Vol 11 (2026),
// i.e. academic years 2023–24 to 2025–26. `featured` marks the ten shown on the homepage; the full list is
// here for a future "all events" page. Images live in /public/site/gallery.

export type TecEvent = {
  id: string;
  /** Sort key, ISO "YYYY-MM" or "YYYY-MM-DD" (day/month estimated from the magazine when it gives none). */
  date: string;
  /** Date as shown to people. */
  when: string;
  kind: string;
  title: string;
  desc: string;
  img?: string;
  featured?: boolean;
  upcoming?: boolean;
  /** Magazine it came from. */
  source: "InterConnect 2024" | "InterConnect 2025" | "InterConnect 2026";
};

const img = (key: string) => `/site/gallery/${key}.webp`;
const V24 = "InterConnect 2024", V25 = "InterConnect 2025", V26 = "InterConnect 2026";

export const allEvents: TecEvent[] = (
  [
    // ---- 2025–26 ----
    { id: "slice-26", date: "2026-08-08", when: "8 Aug 2026", kind: "SYMPOSIUM", upcoming: true, source: V26,
      title: "SLICE '26", desc: "14th National Level Technical Symposium of ECE: PitchFire, Level Quest, Wattage War, CirQuest, Sync or Sink and paper presentations." },
    { id: "eyic-2026", date: "2026-03-27", when: "Mar 2026", kind: "COMPETITION", featured: true, img: img("g-eyic-demo"), source: V26,
      title: "e-Yantra Innovation Challenge", desc: "Team AgriNova's CFD-optimised IoT onion storage system made the Top 16 at the IIT Bombay Grand Finale and won the Technical Excellence Award with ₹1,00,000." },
    { id: "eyrc-2026", date: "2026-03-27", when: "27–28 Mar 2026", kind: "COMPETITION", img: img("g-eyrc-team"), source: V26,
      title: "e-Yantra Robotics Competition Finale", desc: "An autonomous greenhouse drone that finds infected plants and sprays only them, taken to the finale at IIT Bombay." },
    { id: "college-day-2026", date: "2026-03-26", when: "26 Mar 2026", kind: "CEREMONY", source: V26,
      title: "15th College Day", desc: "Awards for academics, projects and co-curriculars, with Mr. Vijay Sankar, Chairman of The Sanmar Group." },
    { id: "conclave-2026", date: "2026-03-13", when: "13 Mar 2026", kind: "PANEL", source: V26,
      title: "Industry–Academia Conclave", desc: "\"Emerging Technologies and Sustainable Indigenization\": industry leaders on the changing role of electronics engineers." },
    { id: "sports-2026", date: "2026-02-21", when: "21 Feb 2026", kind: "SPORTS", img: img("g-sports"), source: V26,
      title: "15th Sports Day", desc: "Track and field, march past and a full day of LICET-wide competition." },
    { id: "iete-day-2026", date: "2026-02-02", when: "2 Feb 2026", kind: "TALK", source: V26,
      title: "IETE Students' Day", desc: "Udu Labs CEO Balaji Krishnarajan on indigenising emerging tech, followed by the \"Fragments to Framework\" design challenge." },
    { id: "vac-2026", date: "2026-01-27", when: "Jan–Feb 2026", kind: "COURSE", img: img("g-vac-embedded"), source: V26,
      title: "Embedded IoT & C++ Courses", desc: "Hands-on value-added courses in embedded IoT, industrial automation and C++, with internship offers for top performers." },
    { id: "thirai-2025", date: "2025-12-29", when: "29 Dec 2025", kind: "ACHIEVEMENT", source: V26,
      title: "\"Thirai\" Wins State Short Film Prize", desc: "A student-made short film took first prize at the Tamil Nadu state-level short film competition in Madurai." },
    { id: "isvct-2025", date: "2025-10-24", when: "24–25 Oct 2025", kind: "CONFERENCE", source: V26,
      title: "Intelligent Systems & Vision Care Conference", desc: "International conference hosted at LICET with Dr. Agarwal's Institute of Optometry." },
    { id: "conclave-2025", date: "2025-10-10", when: "10 Oct 2025", kind: "PANEL", featured: true, img: img("g-conclave"), source: V26,
      title: "Industry–Academia Conclave", desc: "\"Future Ready Minds\": leaders from Zoho, Nokia, Aptiv, HCLTech, Ericsson and more on thriving as engineers in a new era." },
    { id: "core-careers-2025", date: "2025-10-07", when: "7 Oct 2025", kind: "TALK", source: V26,
      title: "Core Engineering Career Perspective", desc: "An interactive session by Balajee Seshadri of Infineon Technologies." },
    { id: "engenia-2025", date: "2025-09-29", when: "29–30 Sep 2025", kind: "CULTURAL", featured: true, img: img("g-engenia-win"), source: V26,
      title: "Engenia 2025", desc: "The college's annual cultural fest: ECE brought the energy across on-stage and off-stage events." },
    { id: "engineers-day-2025", date: "2025-09-15", when: "15 Sep 2025", kind: "TALK", img: img("g-engineers-day"), source: V26,
      title: "Engineers' Day 2025", desc: "\"Engineering in the AI Era: Striking a Balance\" with Madhavi Ravanan of Nokia." },
    { id: "vac-2025", date: "2025-09-04", when: "Sep 2025", kind: "COURSE", img: img("g-vac-vlsi"), source: V26,
      title: "VLSI and IoT + GenAI Courses", desc: "VLSI design & verification with Taras Systems and IoT with Generative AI with Altsense, several students placed as interns." },
    { id: "networks-2025", date: "2025-09-04", when: "4 Sep 2025", kind: "TALK", source: V26,
      title: "Intelligent Networks in the Age of AI", desc: "Guest lecture by Andrew John, Associate Director at WNS Analytics." },
    { id: "clubs-inauguration-2025", date: "2025-08-20", when: "2025", kind: "CEREMONY", source: V26,
      title: "Clubs Inauguration: IEEE, ISF, SEA & TEC", desc: "The year's club activities opened with Verizon's Raman Jankiram on the telecom landscape." },
    { id: "slice-2k25", date: "2025-08-23", when: "23 Aug 2025", kind: "SYMPOSIUM", featured: true, img: img("g-slice-group"), source: V26,
      title: "SLICE 2K25", desc: "The department's national technical symposium hit a record 580 participants across technical and non-technical events." },
    { id: "sip-2025", date: "2025-08-08", when: "8 Aug 2025", kind: "ORIENTATION", img: img("g-sip-1"), source: V26,
      title: "Student Induction: IGNITEEN '25", desc: "The 2025–29 batch met the department, alumni and the clubs, TEC included." },
    { id: "matlab-iot-2025", date: "2025-07-16", when: "16–17 Jul 2025", kind: "WORKSHOP", featured: true, img: img("g-workshop-matlab"), source: V26,
      title: "Simulink & IoT with Arduino", desc: "Two days of hands-on circuit simulation in MATLAB Simulink and IoT integration with Arduino, run with ARK Infosolutions." },
    { id: "orientation-2025", date: "2025-07-07", when: "7 Jul 2025", kind: "TALK", source: V26,
      title: "Discover, Decide and Design Your Future", desc: "Career orientation with speakers from Ginkos India and Zoho." },
    { id: "visits-2026", date: "2025-07-01", when: "2025–26", kind: "VISIT", img: img("g-iv-shar"), source: V26,
      title: "Industrial Visits 2025–26", desc: "Satish Dhawan Space Centre SHAR, NARL, Daikin, Lotte India, TIDC, Space Zone and more." },
    { id: "dft-workshop", date: "2025-07-01", when: "2025–26", kind: "WORKSHOP", source: V26,
      title: "VLSI Design-for-Test Workshop", desc: "Alumnus Ryan Ebenezer (Qualcomm) on DFT and bridging academic and industry expectations in VLSI." },

    // ---- 2024–25 ----
    { id: "icam-paris-2025", date: "2025-06-01", when: "Jun 2025", kind: "EXCHANGE", img: img("f-paris"), source: V25,
      title: "Summer Program at ICAM Paris", desc: "Fifteen students spent a month at ICAM Paris: academics, industry visits and French." },
    { id: "expo-2025", date: "2025-05-16", when: "16 May 2025", kind: "EXPO", source: V25,
      title: "Think-Build-Exhibit: Project Expo 2025", desc: "First-years showed builds for fitness, tourism, rural development, education and transport." },
    { id: "mini-expo-2025", date: "2025-03-25", when: "25 Mar 2025", kind: "EXPO", source: V25,
      title: "Mini-Project Expo", desc: "Third-years presented solutions for people with physical disabilities." },
    { id: "college-day-2025", date: "2025-03-26", when: "26 Mar 2025", kind: "CEREMONY", source: V25,
      title: "14th College Day", desc: "Annual awards with Mr. Anil M Kannat, Director of Sicame GBS." },
    { id: "sports-2025", date: "2025-03-08", when: "8 Mar 2025", kind: "SPORTS", img: img("f-sports"), source: V25,
      title: "14th Sports Day", desc: "ECE took the March Past Championship." },
    { id: "ieee-fishers-2025", date: "2025-03-03", when: "3 Mar 2025", kind: "TALK", source: V25,
      title: "Technology for Deep-Sea Fishers", desc: "IEEE guest lecture by Vincent Joseph and Bino J of IEEE ADSF SIGHT." },
    { id: "pals-innowah", date: "2025-02-15", when: "2024–25", kind: "HACKATHON", featured: true, img: img("f-pals-finals"), source: V25,
      title: "PALS InnoWAH Hackathon", desc: "An AI system for water storage and flood alerts went from online rounds to the Grand Finals, Top 60 of 162 colleges." },
    { id: "iete-day-2025", date: "2025-02-21", when: "21 Feb 2025", kind: "TALK", source: V25,
      title: "IETE Student Day", desc: "Careers for electronics engineers in defence and aerospace, with Data Patterns." },
    { id: "eyrc-2024", date: "2025-02-01", when: "2024–25", kind: "COMPETITION", featured: true, img: img("f-eyrc-champions"), source: V25,
      title: "e-Yantra Robotics: Champions", desc: "A warehouse drone team finished Top 5 in India at IIT Bombay's e-Yantra Robotics Challenge and won their theme." },
    { id: "vac-2025-jan", date: "2025-01-20", when: "Oct 2024 – Jan 2025", kind: "COURSE", img: img("f-vac-lab"), source: V25,
      title: "Embedded, Java and GenAI Courses", desc: "Value-added courses with Tessolve, Silicon Software and Altsense." },
    { id: "defy-25", date: "2025-01-15", when: "2025", kind: "HACKATHON", source: V25,
      title: "Defy '25: First Place", desc: "A decentralised disaster-relief funding platform won the blockchain track at VIT Chennai's 24-hour hackathon." },
    { id: "sih-2024", date: "2024-12-11", when: "Dec 2024", kind: "HACKATHON", featured: true, img: img("f-sih-team"), source: V25,
      title: "Smart India Hackathon Grand Finale", desc: "Team Carbonites pitched a self-sustaining hydrogen-powered hybrid ship against 600+ teams at the SIH 2024 finale." },
    { id: "ethglobal-2024", date: "2024-11-15", when: "Sep–Nov 2024", kind: "HACKATHON", featured: true, img: img("f-ethglobal"), source: V25,
      title: "ETHGlobal Singapore & Bangkok", desc: "LICET builders took top prizes at international ETHGlobal hackathons, thousands of dollars won across tracks." },
    { id: "conclave-2024", date: "2024-11-04", when: "4 Nov 2024", kind: "PANEL", source: V25,
      title: "Industry–Academia Conclave", desc: "\"Digital Transformation: Meeting the Challenges of Industry 4.0\" with Amtex, SyrmaSGS, L&T and Tata Communications." },
    { id: "ieee-debug-2024", date: "2024-10-29", when: "29 Oct 2024", kind: "COMPETITION", source: V25,
      title: "Circuit Debugging & Tech Quiz", desc: "IEEE Student Branch contests in debugging live circuits and tech trivia." },
    { id: "engenia-2024", date: "2024-10-18", when: "18–19 Oct 2024", kind: "CULTURAL", img: img("f-engenia"), source: V25,
      title: "Engenia 2024: Overall Champions", desc: "ECE won the cultural fest for the third year running with 545 points." },
    { id: "visits-2025", date: "2024-10-17", when: "Oct 2024 – Jan 2025", kind: "VISIT", img: img("f-iv"), source: V25,
      title: "Industrial Visits 2024–25", desc: "ISRO's U R Rao Satellite Centre, CSIR Chennai, Urbaser and more." },
    { id: "system-modelling-2024", date: "2024-10-05", when: "5 Oct 2024", kind: "TALK", source: V25,
      title: "System Modelling in Time & Frequency", desc: "Guest lecture by Dr. K. Ragavan, IIT Gandhinagar." },
    { id: "slice-2k24", date: "2024-09-28", when: "28 Sep 2024", kind: "SYMPOSIUM", img: img("f-slice24"), source: V25,
      title: "SLICE 2K24", desc: "The national symposium drew a then-record 572 participants." },
    { id: "pd-workshop-2024", date: "2024-09-23", when: "23–24 Sep 2024", kind: "WORKSHOP", featured: true, img: img("f-pd-workshop"), source: V25,
      title: "Electronic Product Design: End to End", desc: "First-years took a product from idea to working electronics in a two-day hands-on workshop." },
    { id: "embedded-talk-2024", date: "2024-09-23", when: "23 Sep 2024", kind: "TALK", source: V25,
      title: "Embedded Systems: An Industry View", desc: "Hareesh Janakiraman of Embedded-Guru, Houston." },
    { id: "tec-arduino-2024", date: "2024-09-17", when: "17 Sep 2024", kind: "WORKSHOP", source: V25,
      title: "TEC Arduino Workshop", desc: "The Electronics Club's hands-on Arduino workshop, with prizes for the best builds." },
    { id: "engineers-day-2024", date: "2024-09-13", when: "13 Sep 2024", kind: "COMPETITION", img: img("f-sip-2"), source: V25,
      title: "Engineers' Day 2024", desc: "Celebrated by ECE and TEC with a debate and technical events." },
    { id: "association-2024", date: "2024-09-06", when: "6 Sep 2024", kind: "CEREMONY", source: V25,
      title: "Department Association Inauguration", desc: "Opened by Dr. A. Chandra Kala, General Manager at RNTBCI." },
    { id: "sip-2024", date: "2024-09-05", when: "5–24 Sep 2024", kind: "ORIENTATION", img: img("f-sip-1"), source: V25,
      title: "Student Induction 2024–28", desc: "Toy making from waste, club interactions with TEC, IETE and IEEE, and a product design workshop." },
    { id: "space-day-2024", date: "2024-08-23", when: "23 Aug 2024", kind: "COMPETITION", source: V25,
      title: "National Space Day Ideation", desc: "A campus-wide space ideation competition." },

    // ---- 2023–24 ----
    { id: "college-day-2024", date: "2024-04-22", when: "22 Apr 2024", kind: "CEREMONY", source: V24,
      title: "13th College Day", desc: "Annual awards with Mr. Kewyn George of Expeditors." },
    { id: "inses-2024", date: "2024-03-21", when: "21–22 Mar 2024", kind: "CONFERENCE", source: V24,
      title: "INSES-2024: Best Paper Award", desc: "A hybrid MAC unit for AI chips won best paper at the conference LICET hosted with NIT Silchar." },
    { id: "ieee-iot-robots-2024", date: "2024-01-04", when: "4 Jan 2024", kind: "TALK", source: V24,
      title: "Revolutionising Industries with IoT and Robots", desc: "IEEE guest lecture with MELS Automation and PALS." },
    { id: "expo-2023", date: "2023-11-15", when: "Nov–Dec 2023", kind: "EXPO", img: img("m-hardware"), source: V24,
      title: "Project Expos 2023", desc: "Third-years and first-years exhibited their builds to industry and faculty juries." },
    { id: "ieee-inauguration-2023", date: "2023-11-14", when: "14 Nov 2023", kind: "CEREMONY", source: V24,
      title: "IEEE Student Branch & Photonics Society", desc: "Inaugurated with Lt. Dr. T. D. Subash of the IEEE Photonics Society." },
    { id: "conclave-2023", date: "2023-10-30", when: "30 Oct 2023", kind: "PANEL", source: V24,
      title: "Industry–Academia Conclave", desc: "\"Skills for Techade\" with MaxLinear, Mobiveil and Ericsson." },
    { id: "engenia-2023", date: "2023-09-29", when: "29–30 Sep 2023", kind: "CULTURAL", source: V24,
      title: "Engenia 2023: Champions", desc: "ECE won the cultural fest with 505 points and first place in venue decoration." },
    { id: "engineers-day-2023", date: "2023-09-22", when: "22 Sep 2023", kind: "COMPETITION", img: img("m-quiz"), source: V24,
      title: "Engineers' Day 2023", desc: "JAM, Evolve, Quiz, Ideathon and a System Design using Arduino project expo." },
    { id: "slice-2023", date: "2023-09-16", when: "16 Sep 2023", kind: "SYMPOSIUM", source: V24,
      title: "SLICE 2023", desc: "Students from across colleges competed in the national symposium." },
    { id: "clubs-inauguration-2023", date: "2023-09-13", when: "13 Sep 2023", kind: "CEREMONY", source: V24,
      title: "ISF, SEA & TEC Inauguration", desc: "With a talk on in-flight communication by Intelsat's Saravana Manikandan." },
    { id: "sip-2023", date: "2023-08-31", when: "Aug–Nov 2023", kind: "ORIENTATION", img: img("m-equipment"), source: V24,
      title: "Student Induction 2023–27", desc: "A Christmas Toycathon, a product design workshop and a TEC ice-breaker for the new batch." },
    { id: "vac-vlsi-2023", date: "2023-08-21", when: "21–26 Aug 2023", kind: "COURSE", source: V24,
      title: "VLSI Design & Verification Course", desc: "A value-added course with Tessolve Semiconductors." },
    { id: "hackathons-2023", date: "2023-08-04", when: "Aug–Dec 2023", kind: "HACKATHON", source: V24,
      title: "Global Blockchain Hackathon Run", desc: "ETHGlobal, Polygon DevX, Neo APAC and Chainlink wins, over $40,000 for one LICET builder alone." },
    { id: "orientation-2023", date: "2023-07-24", when: "24–25 Jul 2023", kind: "TALK", source: V24,
      title: "Student Orientation Days", desc: "Problem solving with Forge, coding with Zoho and robotics in industry." },
  ] satisfies TecEvent[]
).sort((a, b) => b.date.localeCompare(a.date));

/** The ten on the homepage, newest first. */
export const featuredEvents = allEvents.filter((e) => e.featured);
