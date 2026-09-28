/**
 * Seeds realistic TEC club data. Wipes existing rows first.
 *   npm run db:seed               -> reset + seed
 *   tsx prisma/seed.ts --if-empty -> only seed a fresh database (used by `npm run dev`)
 * Dates are relative to today so overdue returns and timelines always look current.
 * Checkout history (~90 days) comes from a seeded PRNG replayed day by day against the stock
 * counts, so the stock invariants hold at every point in time, not just at the end.
 */
import { existsSync } from "node:fs"
import {
  PrismaClient,
  type Category,
  type Designation,
  type ProjectStatus,
  type ReturnCondition,
  type TaskPriority,
  type TaskStatus,
} from "@prisma/client"
import { todayNoonUTC } from "@/lib/dates"

// Prisma only auto-loads .env if it existed when the client was generated (not true on a fresh
// `npm install`), so load it here. Variables already set in the environment win.
if (existsSync(".env")) process.loadEnvFile(".env")

const db = new PrismaClient()
const DAY = 86_400_000

/** Calendar date `offset` days from today (club time zone), stored at 12:00 UTC like the app does. */
function day(offset: number): Date {
  return new Date(todayNoonUTC().getTime() + offset * DAY)
}
/** A real timestamp on that calendar day at `hour` o'clock club time (IST = UTC+5:30). */
function at(offset: number, hour: number): Date {
  return new Date(day(offset).getTime() + (hour - 17.5) * 3_600_000)
}

// Deterministic PRNG (mulberry32) so every seed of the same day produces the same data.
let seed = 0x7ec2026
function rand() {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1))
const pick = <T,>(a: readonly T[]): T => a[Math.floor(rand() * a.length)]

// ---------- Components (counts are the stock 90 days ago; history below moves them) ----------

type C = {
  key: string
  name: string
  modelNumber?: string
  category: Category
  description: string
  working: number
  damaged?: number
  repair?: number
  location: string
  unitCost?: number
  datasheetUrl?: string
  lowStockThreshold: number
  notes?: string
}

const COMPONENTS: C[] = [
  { key: "uno", name: "Arduino Uno R3", modelNumber: "A000066", category: "MICROCONTROLLER", description: "ATmega328P board, 14 digital I/O, 6 analog inputs. The club's default starter board.", working: 12, damaged: 1, repair: 1, location: "Shelf A1", unitCost: 650, datasheetUrl: "https://docs.arduino.cc/hardware/uno-rev3/", lowStockThreshold: 3 },
  { key: "esp32", name: "ESP32 DevKit V1", modelNumber: "ESP32-WROOM-32", category: "MICROCONTROLLER", description: "Dual-core 240 MHz MCU with Wi-Fi and Bluetooth. 30-pin DOIT board.", working: 15, damaged: 1, location: "Shelf A1", unitCost: 450, datasheetUrl: "https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32_datasheet_en.pdf", lowStockThreshold: 4 },
  { key: "rpi4", name: "Raspberry Pi 4 Model B (4GB)", modelNumber: "RPI4-MODBP-4GB", category: "MICROCONTROLLER", description: "Quad-core Cortex-A72 SBC. Comes with 32 GB microSD and official USB-C supply.", working: 4, location: "Locked cabinet C1", unitCost: 5500, datasheetUrl: "https://datasheets.raspberrypi.com/rpi4/raspberry-pi-4-datasheet.pdf", lowStockThreshold: 1, notes: "Issue only to core members; log SD card image used." },
  { key: "hcsr04", name: "HC-SR04 Ultrasonic Sensor", modelNumber: "HC-SR04", category: "SENSOR", description: "2 cm – 400 cm ranging module, 5 V.", working: 18, damaged: 2, location: "Box B3", unitCost: 60, lowStockThreshold: 5 },
  { key: "mpu6050", name: "MPU6050 6-Axis IMU", modelNumber: "GY-521", category: "SENSOR", description: "3-axis gyro + 3-axis accelerometer over I²C.", working: 9, repair: 1, location: "Box B3", unitCost: 150, datasheetUrl: "https://invensense.tdk.com/wp-content/uploads/2015/02/MPU-6000-Datasheet1.pdf", lowStockThreshold: 3, notes: "One unit has a cracked header — resoldering." },
  { key: "dht22", name: "DHT22 Temperature & Humidity Sensor", modelNumber: "AM2302", category: "SENSOR", description: "±0.5 °C, 0–100 % RH, single-wire digital output.", working: 4, location: "Box B3", unitCost: 280, lowStockThreshold: 2 },
  { key: "soil", name: "Capacitive Soil Moisture Sensor v1.2", category: "SENSOR", description: "Corrosion-resistant capacitive probe, 3.3–5 V analog output.", working: 10, location: "Box B3", unitCost: 45, lowStockThreshold: 3 },
  { key: "ir", name: "TCRT5000 IR Line Sensor", modelNumber: "TCRT5000", category: "SENSOR", description: "Reflective IR sensor module with comparator output, for line following.", working: 12, location: "Box B3", unitCost: 35, lowStockThreshold: 4 },
  { key: "l298n", name: "L298N Dual H-Bridge Motor Driver", modelNumber: "L298N", category: "ACTUATOR_MOTOR", description: "Drives two DC motors up to 2 A each, onboard 5 V regulator.", working: 7, damaged: 1, location: "Box B5", unitCost: 140, lowStockThreshold: 2 },
  { key: "sg90", name: "SG90 Micro Servo", modelNumber: "SG90", category: "ACTUATOR_MOTOR", description: "9 g servo, 180°, 1.8 kg·cm torque.", working: 22, damaged: 3, location: "Box B5", unitCost: 90, lowStockThreshold: 6 },
  { key: "bo", name: "BO Motor 100 RPM with Wheel", modelNumber: "BO-100", category: "ACTUATOR_MOTOR", description: "Dual-shaft plastic gear motor, 3–12 V, with 65 mm wheel.", working: 16, location: "Box B6", unitCost: 70, lowStockThreshold: 4 },
  { key: "breadboard", name: "Half-size Breadboard (400 points)", category: "TOOL", description: "Solderless breadboard with power rails.", working: 28, damaged: 2, location: "Drawer D1", unitCost: 80, lowStockThreshold: 8 },
  { key: "jumpers", name: "Jumper Wire Set (120 pcs)", category: "CONSUMABLE", description: "40 each of M-M, M-F and F-F, 20 cm.", working: 20, location: "Drawer D2", unitCost: 120, lowStockThreshold: 5, notes: "Not expected back — treat as consumed after issue." },
  { key: "cell18650", name: "18650 Li-ion Cell 2600 mAh", category: "POWER", description: "Protected cells. Charge only on the club charger.", working: 8, damaged: 2, repair: 2, location: "Fireproof box P1", unitCost: 220, lowStockThreshold: 6, notes: "Two cells swelling — do not issue those, awaiting disposal." },
  { key: "lm2596", name: "LM2596 Buck Converter", modelNumber: "LM2596S", category: "POWER", description: "Adjustable step-down, 3–40 V in, 1.5–35 V out, 3 A.", working: 10, location: "Box B7", unitCost: 95, lowStockThreshold: 3 },
  { key: "hc05", name: "HC-05 Bluetooth Module", modelNumber: "HC-05", category: "COMMUNICATION", description: "Classic Bluetooth SPP serial module, master/slave.", working: 6, location: "Box B4", unitCost: 320, lowStockThreshold: 2 },
  { key: "nrf24", name: "nRF24L01+ Transceiver", modelNumber: "NRF24L01+", category: "COMMUNICATION", description: "2.4 GHz radio, 2 Mbps, SPI.", working: 3, damaged: 1, location: "Box B4", unitCost: 110, lowStockThreshold: 2 },
  { key: "oled", name: '0.96" OLED Display', modelNumber: "SSD1306", category: "DISPLAY", description: "128×64 monochrome, I²C.", working: 9, damaged: 1, location: "Box B8", unitCost: 230, lowStockThreshold: 3 },
  { key: "lcd", name: "16×2 LCD with I²C Backpack", modelNumber: "LCD1602 + PCF8574", category: "DISPLAY", description: "Character LCD, blue backlight, 4-wire I²C.", working: 6, damaged: 1, location: "Box B8", unitCost: 180, lowStockThreshold: 2 },
  { key: "dmm", name: "Digital Multimeter", modelNumber: "DT830D", category: "TOOL", description: "Voltage, current, resistance, continuity.", working: 3, repair: 1, location: "Shelf T1", unitCost: 450, lowStockThreshold: 1 },
  { key: "solder", name: "Soldering Station 60 W", modelNumber: "SS-60", category: "TOOL", description: "Temperature-controlled iron, 200–480 °C, with stand and tip cleaner.", working: 4, repair: 1, location: "Shelf T2", unitCost: 1400, lowStockThreshold: 1, notes: "Tips are consumables — ask before swapping." },
]

// ---------- Members & teams ----------

type M = {
  key: string
  name: string
  rollNumber: string
  department: string
  yearOfStudy: number
  designation: Designation
  phone?: string
  isActive?: boolean
}

const MEMBERS: M[] = [
  { key: "aarav", name: "Aarav Sharma", rollNumber: "23CS014", department: "Computer Science", yearOfStudy: 4, designation: "PRESIDENT", phone: "+91 98450 11234" },
  { key: "diya", name: "Diya Nair", rollNumber: "23EC021", department: "Electronics & Communication", yearOfStudy: 4, designation: "VICE_PRESIDENT", phone: "+91 98860 44120" },
  { key: "rohan", name: "Rohan Iyer", rollNumber: "24CS032", department: "Computer Science", yearOfStudy: 3, designation: "SECRETARY", phone: "+91 90080 55671" },
  { key: "sneha", name: "Sneha Reddy", rollNumber: "24EE008", department: "Electrical & Electronics", yearOfStudy: 3, designation: "JOINT_SECRETARY" },
  { key: "karthik", name: "Karthik Menon", rollNumber: "24IT017", department: "Information Technology", yearOfStudy: 3, designation: "TREASURER", phone: "+91 97410 90876" },
  { key: "ananya", name: "Ananya Gupta", rollNumber: "24EC045", department: "Electronics & Communication", yearOfStudy: 3, designation: "CORE_MEMBER" },
  { key: "fatima", name: "Fatima Sheikh", rollNumber: "24EC033", department: "Electronics & Communication", yearOfStudy: 3, designation: "CORE_MEMBER", phone: "+91 99001 23877" },
  { key: "vikram", name: "Vikram Singh", rollNumber: "25ME012", department: "Mechanical", yearOfStudy: 2, designation: "CORE_MEMBER" },
  { key: "ishaan", name: "Ishaan Kulkarni", rollNumber: "25ME020", department: "Mechanical", yearOfStudy: 2, designation: "MEMBER" },
  { key: "priya", name: "Priya Das", rollNumber: "25CS051", department: "Computer Science", yearOfStudy: 2, designation: "MEMBER", isActive: false },
  { key: "arjun", name: "Arjun Patel", rollNumber: "26EC006", department: "Electronics & Communication", yearOfStudy: 1, designation: "MEMBER" },
  { key: "meera", name: "Meera Krishnan", rollNumber: "26CS029", department: "Computer Science", yearOfStudy: 1, designation: "MEMBER" },
  { key: "neha", name: "Neha Joshi", rollNumber: "26CS011", department: "Computer Science", yearOfStudy: 1, designation: "MEMBER" },
]

const TEAMS = [
  {
    key: "robotics",
    name: "Robotics",
    description: "Mobile robots, manipulators and anything with motors. Builds the club's competition rovers.",
    members: [["vikram", "Team Lead"], ["diya", "Hardware"], ["rohan", "Software"], ["arjun", "Hardware"], ["ishaan", "Mechanical"], ["aarav", "Mentor"]],
  },
  {
    key: "iot",
    name: "IoT & Embedded",
    description: "Connected sensors, low-power devices and the smart-campus initiative.",
    members: [["ananya", "Team Lead"], ["sneha", "Hardware"], ["karthik", "Software"], ["meera", "Software"], ["priya", "Cloud"]],
  },
  {
    key: "maker",
    name: "PCB & Maker Lab",
    description: "Custom PCBs, enclosures and fabrication — and the workshops that teach first-years to solder.",
    members: [["fatima", "Team Lead"], ["neha", "Firmware"], ["ishaan", "CAD & Fabrication"], ["aarav", "Mentor"]],
  },
] as const

// ---------- Projects: updates are spread evenly from start to `lastUpdate`; tasks are [title, status, priority, due] ----------

type P = {
  key: string
  title: string
  description: string
  team: string | null
  status: ProjectStatus
  start: number
  target: number
  lastUpdate: number
  techStack: Record<"languages" | "frameworks" | "hardware" | "tools" | "cloud", string[]>
  members: [string, string][]
  components: [string, number][]
  updates: [string, number][]
  tasks: [string, TaskStatus, TaskPriority, number | null][]
}

const PROJECTS: P[] = [
  {
    key: "rover",
    title: "Autonomous Line-Following Rover",
    description:
      "A four-wheel rover that follows a taped track, avoids obstacles with ultrasonic ranging and holds heading with an IMU. Target: inter-college robotics meet.",
    team: "robotics",
    status: "IN_PROGRESS",
    start: -72,
    target: 34,
    lastUpdate: -4,
    techStack: {
      languages: ["C++", "Python"],
      frameworks: ["Arduino", "ROS 2"],
      hardware: ["Arduino Uno R3", "L298N", "HC-SR04", "MPU6050", "TCRT5000", "BO motors"],
      tools: ["PlatformIO", "KiCad", "Fusion 360"],
      cloud: [],
    },
    members: [["vikram", "Project Lead"], ["rohan", "Firmware"], ["arjun", "Chassis & Wiring"], ["ishaan", "Mechanical Design"]],
    components: [["uno", 2], ["l298n", 2], ["hcsr04", 3], ["mpu6050", 1], ["bo", 4], ["ir", 3], ["cell18650", 3], ["rpi4", 1]],
    updates: [
      ["Kickoff. Finalised chassis layout and bill of materials.", 5],
      ["Motor sizing done; ordered wheels and a second L298N.", 12],
      ["Chassis 3D-printed. Motors and L298N wired and bench-tested.", 20],
      ["TCRT5000 line-sensor array mounted; raw readings logged on the practice track.", 28],
      ["First laps on the taped track — overshoots corners at full speed.", 35],
      ["IR line sensing stable on the practice track. PID tuning started.", 42],
      ["PID gains tuned; lap time down from 41 s to 29 s.", 50],
      ["Obstacle avoidance with HC-SR04 integrated behind a state machine.", 57],
      ["Pi 4 added for ROS 2 experiments; serial bridge to the Uno working.", 61],
      ["IMU heading correction in progress; drift under 3° per lap.", 65],
    ],
    tasks: [
      ["Finalise chassis layout and BOM", "DONE", "HIGH", -66],
      ["Print chassis and motor mounts", "DONE", "MEDIUM", -55],
      ["Wire L298N and bench-test both motors", "DONE", "HIGH", -50],
      ["Mount TCRT5000 line-sensor array", "DONE", "MEDIUM", -44],
      ["Tune line-following PID", "DONE", "HIGH", -26],
      ["Integrate HC-SR04 obstacle avoidance", "DONE", "HIGH", -14],
      ["Serial bridge between Pi 4 and Uno", "DONE", "MEDIUM", -7],
      ["IMU heading correction", "IN_PROGRESS", "HIGH", 5],
      ["ROS 2 telemetry node", "IN_PROGRESS", "MEDIUM", -2],
      ["Battery holder and power switch", "TODO", "MEDIUM", -1],
      ["Practice run on a competition-size track", "TODO", "HIGH", 20],
      ["Write the competition report", "TODO", "LOW", 30],
    ],
  },
  {
    key: "garden",
    title: "Smart Campus Garden Monitor",
    description:
      "Solar-powered ESP32 nodes that report soil moisture, temperature and humidity from the campus garden to a live dashboard, with alerts when beds need watering.",
    team: "iot",
    status: "IN_PROGRESS",
    start: -55,
    target: 50,
    lastUpdate: -3,
    techStack: {
      languages: ["C++", "TypeScript"],
      frameworks: ["Arduino-ESP32", "Next.js"],
      hardware: ["ESP32 DevKit V1", "DHT22", "Capacitive soil sensor", "SSD1306 OLED"],
      tools: ["VS Code", "Grafana"],
      cloud: ["HiveMQ MQTT", "Firebase"],
    },
    members: [["ananya", "Project Lead"], ["karthik", "Backend"], ["meera", "Dashboard"], ["sneha", "Sensors & Power"]],
    components: [["esp32", 3], ["dht22", 3], ["soil", 3], ["oled", 2], ["cell18650", 4], ["lm2596", 2]],
    updates: [
      ["Requirements agreed with the horticulture club. Sensor shortlist done.", 5],
      ["Capacitive soil sensors calibrated against dry and wet reference pots.", 10],
      ["ESP32 publishing DHT22 readings over MQTT every 60 s.", 18],
      ["Deep sleep cut node current to 0.2 mA between readings.", 24],
      ["Solar + 18650 power prototype running 3 days unattended.", 30],
      ["Dashboard skeleton up: live readings and 24 h history per bed.", 34],
      ["Two nodes deployed in beds 1 and 2; one dropped off Wi-Fi overnight — investigating.", 37],
      ["Watering alerts drafted; waiting on the horticulture club to confirm thresholds.", 40],
    ],
    tasks: [
      ["Agree requirements with the horticulture club", "DONE", "MEDIUM", -50],
      ["Calibrate capacitive soil sensors", "DONE", "HIGH", -44],
      ["MQTT publishing from ESP32 nodes", "DONE", "HIGH", -34],
      ["Deep-sleep power budget", "DONE", "MEDIUM", -24],
      ["Solar charging enclosure", "IN_PROGRESS", "HIGH", 6],
      ["Live dashboard: per-bed history", "IN_PROGRESS", "MEDIUM", 10],
      ["Fix node dropping off Wi-Fi overnight", "IN_PROGRESS", "HIGH", -3],
      ["Watering alert thresholds", "TODO", "MEDIUM", 14],
      ["Weatherproof the sensor probes", "TODO", "MEDIUM", 21],
      ["Deploy nodes in beds 3–6", "TODO", "HIGH", 35],
      ["Handover guide for the horticulture club", "TODO", "LOW", 48],
    ],
  },
  {
    key: "arm",
    title: "Gesture-Controlled Robotic Arm",
    description:
      "A 4-DOF servo arm driven by a glove-mounted MPU6050 over Bluetooth. Built as an open-house demo — no team, just two members who wanted to build it.",
    team: null,
    status: "COMPLETED",
    start: -110,
    target: -20,
    lastUpdate: -18,
    techStack: {
      languages: ["C++"],
      frameworks: ["Arduino"],
      hardware: ["Arduino Uno R3", "MPU6050", "SG90", "HC-05"],
      tools: ["Tinkercad", "Fusion 360"],
      cloud: [],
    },
    members: [["diya", "Project Lead"], ["priya", "Firmware"]],
    components: [["sg90", 4], ["hc05", 2], ["mpu6050", 1], ["uno", 1]],
    updates: [
      ["Arm geometry sketched; servo torque budget checked.", 8],
      ["Base and shoulder printed; SG90s fitted.", 18],
      ["Glove prototype: MPU6050 on a velcro strap, angles streaming over serial.", 30],
      ["HC-05 pairing between glove and arm working.", 42],
      ["Glove angles mapped to servo positions over HC-05.", 52],
      ["Jitter traced to noisy accelerometer readings; trying a complementary filter.", 60],
      ["Complementary filter in — motion is smooth. Gripper redesign started.", 72],
      ["New gripper holds a 100 g load; one servo stripped a gear during testing.", 84],
      ["Rehearsed the open-house demo; recalibrated after a battery swap.", 94],
      ["Demoed at open house. Parts returned to inventory.", 100],
    ],
    tasks: [
      ["Sketch arm geometry and torque budget", "DONE", "HIGH", -105],
      ["Print base, shoulder and elbow", "DONE", "MEDIUM", -95],
      ["Glove IMU prototype", "DONE", "HIGH", -80],
      ["Bluetooth link from glove to arm", "DONE", "HIGH", -70],
      ["Map glove angles to servo positions", "DONE", "HIGH", -62],
      ["Filter IMU jitter", "DONE", "MEDIUM", -50],
      ["Redesign the gripper", "DONE", "MEDIUM", -35],
      ["Open-house demo rehearsal", "DONE", "LOW", -20],
    ],
  },
  {
    key: "macropad",
    title: "Club Macro-Pad PCB",
    description:
      "A 12-key hot-swap macro pad with an OLED status screen for the club's streaming desk — the Maker Lab's first fully custom PCB.",
    team: "maker",
    status: "ON_HOLD",
    start: -85,
    target: -5,
    lastUpdate: -30,
    techStack: {
      languages: ["C"],
      frameworks: ["QMK"],
      hardware: ["RP2040", "Kailh hot-swap sockets", "SSD1306 OLED"],
      tools: ["KiCad", "Fusion 360"],
      cloud: [],
    },
    members: [["fatima", "Project Lead"], ["neha", "Firmware"], ["ishaan", "Case Design"]],
    components: [["solder", 1], ["oled", 1]],
    updates: [
      ["Scope: 12-key hot-swap macro pad for the club's streaming desk. Switch samples ordered.", 5],
      ["Schematic done in KiCad; RP2040 chosen over the ATmega32U4.", 12],
      ["Footprints checked; first two-layer PCB layout routed.", 20],
      ["DRC clean. Quotes in from two fab houses.", 26],
      ["QMK firmware skeleton builds; OLED status screen working on a breadboard.", 32],
      ["OLED glass cracked during a fit test — replacement requested.", 35],
      ["Paused: waiting on the college to approve the PCB fabrication budget.", 35],
    ],
    tasks: [
      ["Pick MCU and switch type", "DONE", "MEDIUM", -78],
      ["Schematic in KiCad", "DONE", "HIGH", -66],
      ["Route the two-layer PCB", "DONE", "HIGH", -50],
      ["Get fab quotes approved", "IN_PROGRESS", "HIGH", -20],
      ["Order PCBs and hot-swap sockets", "TODO", "HIGH", null],
      ["QMK keymap and OLED status screen", "TODO", "MEDIUM", null],
      ["3D-print case and plate", "TODO", "MEDIUM", null],
      ["Assemble and test all 12 keys", "TODO", "MEDIUM", null],
      ["Document the build for the club wiki", "TODO", "LOW", null],
    ],
  },
  {
    key: "air",
    title: "Campus Air-Quality Mesh",
    description:
      "Battery-powered PM2.5 and CO₂ nodes around the quad, linked by an nRF24 mesh to a gateway that publishes hourly averages for the environmental club.",
    team: "iot",
    status: "PLANNING",
    start: -9,
    target: 80,
    lastUpdate: -2,
    techStack: {
      languages: ["C++", "Python"],
      frameworks: ["Arduino-ESP32", "RF24Mesh"],
      hardware: ["ESP32 DevKit V1", "nRF24L01+", "PMS5003", "SCD40"],
      tools: ["PlatformIO"],
      cloud: ["InfluxDB"],
    },
    members: [["meera", "Project Lead"], ["karthik", "Gateway"], ["fatima", "PCB"]],
    components: [["nrf24", 4], ["esp32", 4]],
    updates: [
      ["Kickoff with the environmental club. Picked PM2.5 and CO₂ sensors to evaluate.", 5],
      ["nRF24 mesh range test across the quad: 60 m line of sight.", 10],
    ],
    tasks: [
      ["Kickoff with the environmental club", "DONE", "MEDIUM", -7],
      ["nRF24 mesh range test", "IN_PROGRESS", "HIGH", 3],
      ["Shortlist PM2.5 and CO₂ sensors", "TODO", "HIGH", 5],
      ["Budget and parts request", "TODO", "LOW", 10],
      ["Power budget for a week on battery", "TODO", "MEDIUM", 14],
      ["Pick mesh topology and gateway", "TODO", "MEDIUM", 18],
      ["Enclosure with airflow for the PM sensor", "TODO", "MEDIUM", 25],
    ],
  },
]

// ---------- Issuances ----------

type I = {
  comp: string
  qty: number
  to: string
  project?: string
  issued: number
  expected?: number
  returned?: number
  condition?: ReturnCondition
  notes?: string
}

// Hand-written checkouts: everything open right now (incl. overdue and due-soon) plus notable history.
// Rows sharing an issue date and returned in different conditions mirror how the app splits partial returns.
const CURATED: I[] = [
  // Rover — open
  { comp: "uno", qty: 2, to: "rohan", project: "rover", issued: -60, expected: 34 },
  { comp: "l298n", qty: 2, to: "arjun", project: "rover", issued: -55, expected: 34 },
  { comp: "bo", qty: 4, to: "vikram", project: "rover", issued: -55, expected: 34 },
  { comp: "ir", qty: 3, to: "arjun", project: "rover", issued: -50, expected: 34 },
  { comp: "hcsr04", qty: 3, to: "arjun", project: "rover", issued: -30, expected: 34 },
  { comp: "mpu6050", qty: 1, to: "rohan", project: "rover", issued: -45, expected: -20, returned: -21, condition: "WORKING", notes: "Return: swapped for a better-calibrated unit" },
  { comp: "mpu6050", qty: 1, to: "rohan", project: "rover", issued: -21, expected: 34 },
  { comp: "rpi4", qty: 1, to: "rohan", project: "rover", issued: -8, expected: 20, notes: "ROS 2 experiments — Ubuntu 22.04 image" },
  { comp: "cell18650", qty: 3, to: "ishaan", project: "rover", issued: -12, expected: 2 },
  // Garden — open, two overdue
  { comp: "esp32", qty: 3, to: "karthik", project: "garden", issued: -40, expected: 50 },
  { comp: "dht22", qty: 2, to: "sneha", project: "garden", issued: -38, expected: 50 },
  { comp: "soil", qty: 3, to: "sneha", project: "garden", issued: -38, expected: 50 },
  { comp: "lm2596", qty: 2, to: "sneha", project: "garden", issued: -24, expected: 1 },
  { comp: "cell18650", qty: 4, to: "sneha", project: "garden", issued: -25, expected: -4, notes: "Solar prototype endurance test" },
  { comp: "oled", qty: 1, to: "meera", project: "garden", issued: -20, expected: -6 },
  // Air-quality mesh — open, due soon
  { comp: "nrf24", qty: 2, to: "meera", project: "air", issued: -5, expected: 3, notes: "Range test across the quad" },
  { comp: "esp32", qty: 1, to: "meera", project: "air", issued: -5, expected: 0 },
  // Club — open
  { comp: "dmm", qty: 1, to: "aarav", issued: -18, expected: -11, notes: "Workshop prep" },
  { comp: "breadboard", qty: 5, to: "diya", issued: -3, expected: 6, notes: "Arduino 101 workshop for first-years" },
  // Arm — returned after the open house
  { comp: "sg90", qty: 3, to: "diya", project: "arm", issued: -100, expected: -20, returned: -17, condition: "WORKING" },
  { comp: "sg90", qty: 1, to: "diya", project: "arm", issued: -100, expected: -20, returned: -17, condition: "DAMAGED", notes: "Return: stripped gear" },
  { comp: "uno", qty: 1, to: "diya", project: "arm", issued: -100, expected: -20, returned: -17, condition: "WORKING" },
  { comp: "hc05", qty: 2, to: "priya", project: "arm", issued: -95, expected: -20, returned: -17, condition: "WORKING" },
  { comp: "mpu6050", qty: 1, to: "priya", project: "arm", issued: -95, expected: -20, returned: -16, condition: "WORKING" },
  // Macro pad — returned before the pause
  { comp: "solder", qty: 1, to: "fatima", project: "macropad", issued: -80, expected: -40, returned: -38, condition: "WORKING" },
  { comp: "oled", qty: 1, to: "neha", project: "macropad", issued: -70, expected: -30, returned: -29, condition: "DAMAGED", notes: "Return: cracked glass during fit test" },
  // Lost
  { comp: "esp32", qty: 1, to: "meera", issued: -88, expected: -60, returned: -58, condition: "LOST", notes: "Return: left at hackathon venue" },
  { comp: "sg90", qty: 1, to: "arjun", issued: -40, expected: -30, returned: -31, condition: "LOST" },
]

const HISTORY_DAYS = 90
const WORKSHOP_DAYS = [-63, -35] // Saturday workshops: bursts of starter-kit checkouts
const RANDOM_NOTES = ["Lab practice", "Mini-project", "Hackathon", "Coursework demo", "Weekend build", "Testing a library"]

/**
 * Replays CURATED plus random background checkouts day by day, tracking stock per component,
 * and returns every issuance plus the final stock. Random checkouts only ever use units that no
 * curated checkout will need, so units on open issuances never exceed working units on any day.
 */
function simulate() {
  const byKey = new Map(COMPONENTS.map((c) => [c.key, c]))
  const stock = new Map(
    COMPONENTS.map((c) => [c.key, { working: c.working, damaged: c.damaged ?? 0, total: c.working + (c.damaged ?? 0) + (c.repair ?? 0) }])
  )
  const open = new Map(COMPONENTS.map((c) => [c.key, { curated: 0, random: 0 }]))
  const randomLoss = new Map<string, number>()
  const randomOpenAtEnd = new Map<string, number>()
  const out: (I & { random?: boolean })[] = []
  const returnsOn = new Map<number, (I & { random?: boolean })[]>()

  // Reserve for each component: its peak curated open units plus curated units that will leave working stock.
  const peak = new Map<string, number>()
  const pendingLoss = new Map<string, number>()
  for (let d = -120; d <= 0; d++) {
    const level = new Map<string, number>()
    for (const x of CURATED) {
      if (x.issued <= d && (x.returned === undefined || x.returned > d)) level.set(x.comp, (level.get(x.comp) ?? 0) + x.qty)
    }
    for (const [k, v] of level) peak.set(k, Math.max(peak.get(k) ?? 0, v))
  }
  for (const x of CURATED) {
    if (x.condition === "DAMAGED" || x.condition === "LOST") pendingLoss.set(x.comp, (pendingLoss.get(x.comp) ?? 0) + x.qty)
  }

  const members = MEMBERS.filter((m) => m.isActive !== false)
  const pool = COMPONENTS.filter((c) => c.category !== "CONSUMABLE")

  function schedule(x: I & { random?: boolean }) {
    out.push(x)
    if (x.returned !== undefined) returnsOn.set(x.returned, [...(returnsOn.get(x.returned) ?? []), x])
  }

  function randomIssue(d: number, forced?: string) {
    const c = forced ? byKey.get(forced)! : pick(pool)
    const member = pick(c.key === "rpi4" ? members.filter((m) => m.designation !== "MEMBER") : members)
    const s = stock.get(c.key)!
    const o = open.get(c.key)!
    const room = s.working - (peak.get(c.key) ?? 0) - (pendingLoss.get(c.key) ?? 0) - o.random
    const bulk = ["breadboard", "sg90", "hcsr04", "bo", "ir"].includes(c.key)
    const qty = Math.min(room, forced ? 1 : bulk ? randInt(1, 3) : 1)
    if (qty < 1) return

    // Tag with a running project the member is on, if that project lists the component.
    const project = PROJECTS.find(
      (p) => p.start <= d && d <= p.lastUpdate && p.members.some(([k]) => k === member.key) && p.components.some(([k]) => k === c.key)
    )
    const expected = d + (forced ? 7 : randInt(4, 21))
    let returned: number | undefined = Math.max(d + 1, expected + randInt(-4, 5))
    if (returned > -1) {
      // Still out today only if comfortably in stock and not due soon; otherwise brought back recently.
      const keep = expected >= 5 && c.working >= 12 && (randomOpenAtEnd.get(c.key) ?? 0) + qty <= 2
      if (keep) randomOpenAtEnd.set(c.key, (randomOpenAtEnd.get(c.key) ?? 0) + qty)
      returned = keep ? undefined : randInt(Math.max(d + 1, -3), -1)
    }
    let condition: ReturnCondition | undefined
    if (returned !== undefined) {
      const r = rand()
      const canLose = qty === 1 && c.working >= 10 && (randomLoss.get(c.key) ?? 0) < 2
      condition = canLose && r < 0.06 ? "DAMAGED" : canLose && r < 0.085 ? "LOST" : "WORKING"
      if (condition !== "WORKING") randomLoss.set(c.key, (randomLoss.get(c.key) ?? 0) + 1)
    }
    o.random += qty
    schedule({
      comp: c.key,
      qty,
      to: member.key,
      project: project && rand() < 0.7 ? project.key : undefined,
      issued: d,
      expected,
      returned,
      condition,
      notes: forced ? "Arduino 101 workshop" : !project && rand() < 0.35 ? pick(RANDOM_NOTES) : undefined,
      random: true,
    })
  }

  const firstDay = Math.min(...CURATED.map((x) => x.issued), -HISTORY_DAYS)
  for (let d = firstDay; d <= 0; d++) {
    for (const x of returnsOn.get(d) ?? []) {
      const s = stock.get(x.comp)!
      const o = open.get(x.comp)!
      if (x.random) o.random -= x.qty
      else o.curated -= x.qty
      if (x.condition === "DAMAGED") {
        s.working -= x.qty
        s.damaged += x.qty
      } else if (x.condition === "LOST") {
        s.working -= x.qty
        s.total -= x.qty
      }
      if (!x.random && (x.condition === "DAMAGED" || x.condition === "LOST")) pendingLoss.set(x.comp, pendingLoss.get(x.comp)! - x.qty)
    }
    for (const x of CURATED.filter((x) => x.issued === d)) {
      open.get(x.comp)!.curated += x.qty
      schedule(x)
    }
    if (d >= -HISTORY_DAYS && d <= -2) {
      const weekday = day(d).getUTCDay()
      const rate = 1.3 * (weekday === 0 ? 0.2 : weekday === 6 ? 1.6 : 1)
      const n = Math.floor(rate) + (rand() < rate % 1 ? 1 : 0)
      for (let i = 0; i < n; i++) randomIssue(d)
      if (WORKSHOP_DAYS.includes(d)) for (let i = 0; i < 6; i++) randomIssue(d, i % 2 ? "uno" : "breadboard")
    }
    for (const [k, o] of open) {
      if (o.curated + o.random > stock.get(k)!.working) throw new Error(`Seed bug: ${k} over-issued on day ${d}`)
    }
  }
  return { issuances: out, stock }
}

// ---------- Write ----------

async function main() {
  if (process.argv.includes("--if-empty") && (await db.component.count()) > 0) {
    console.log("Database already has data — skipping seed.")
    return
  }

  // Children first.
  await db.task.deleteMany()
  await db.issuance.deleteMany()
  await db.progressUpdate.deleteMany()
  await db.projectComponent.deleteMany()
  await db.projectMember.deleteMany()
  await db.teamMember.deleteMany()
  await db.project.deleteMany()
  await db.team.deleteMany()
  await db.member.deleteMany()
  await db.component.deleteMany()

  const sim = simulate()

  const c: Record<string, string> = {}
  for (const x of COMPONENTS) {
    const s = sim.stock.get(x.key)!
    const row = await db.component.create({
      data: {
        name: x.name,
        modelNumber: x.modelNumber,
        category: x.category,
        description: x.description,
        quantityWorking: s.working,
        quantityDamaged: s.damaged,
        quantityUnderRepair: x.repair ?? 0,
        quantityTotal: s.total,
        location: x.location,
        unitCost: x.unitCost,
        datasheetUrl: x.datasheetUrl,
        lowStockThreshold: x.lowStockThreshold,
        notes: x.notes,
      },
    })
    c[x.key] = row.id
  }

  const m: Record<string, string> = {}
  for (const x of MEMBERS) {
    const [first, last] = x.name.toLowerCase().split(" ")
    const row = await db.member.create({
      data: {
        name: x.name,
        rollNumber: x.rollNumber,
        department: x.department,
        yearOfStudy: x.yearOfStudy,
        designation: x.designation,
        email: `${first}.${last}@tec-college.edu`,
        phone: x.phone,
        isActive: x.isActive ?? true,
      },
    })
    m[x.key] = row.id
  }

  const t: Record<string, string> = {}
  for (const x of TEAMS) {
    const row = await db.team.create({
      data: {
        name: x.name,
        description: x.description,
        members: { create: x.members.map(([k, roleInTeam]) => ({ memberId: m[k], roleInTeam })) },
      },
    })
    t[x.key] = row.id
  }

  const p: Record<string, string> = {}
  for (const x of PROJECTS) {
    const n = x.updates.length
    const row = await db.project.create({
      data: {
        title: x.title,
        description: x.description,
        teamId: x.team ? t[x.team] : null,
        status: x.status,
        progressPercent: x.updates[n - 1][1],
        startDate: day(x.start),
        targetDate: day(x.target),
        techStack: x.techStack,
        members: { create: x.members.map(([k, roleInProject]) => ({ memberId: m[k], roleInProject })) },
        components: { create: x.components.map(([k, quantityRequired]) => ({ componentId: c[k], quantityRequired })) },
        progressUpdates: {
          // Roughly weekly: spread from two days after the start to the last update, with a day of jitter.
          create: x.updates.map(([note, percentAtUpdate], i) => {
            const on = n === 1 ? x.lastUpdate : Math.round(x.start + 2 + ((x.lastUpdate - x.start - 2) * i) / (n - 1))
            const jitter = i === 0 || i === n - 1 ? 0 : randInt(-1, 1)
            return { date: day(on + jitter), note, percentAtUpdate, updatedByMemberId: m[x.members[i % x.members.length][0]] }
          }),
        },
      },
    })
    p[x.key] = row.id

    const order: Record<TaskStatus, number> = { TODO: 0, IN_PROGRESS: 0, DONE: 0 }
    await db.task.createMany({
      data: x.tasks.map(([title, status, priority, due], i) => {
        const doneOn = status === "DONE" && due !== null ? Math.min(-1, Math.max(x.start + 1, due + randInt(-3, 1))) : null
        const created = Math.min(x.start + randInt(0, 10), (doneOn ?? due ?? 0) - 1, -1)
        const assignee = status === "TODO" && rand() < 0.15 ? null : x.members[(i + randInt(0, 1)) % x.members.length][0]
        return {
          projectId: row.id,
          title,
          status,
          priority,
          assigneeId: assignee ? m[assignee] : null,
          dueDate: due === null ? null : day(due),
          order: order[status]++,
          completedAt: doneOn === null ? null : at(doneOn, randInt(10, 22)),
          createdAt: at(Math.max(created, x.start), randInt(9, 20)),
        }
      }),
    })
  }

  await db.issuance.createMany({
    data: sim.issuances.map((x) => ({
      componentId: c[x.comp],
      quantity: x.qty,
      issuedToMemberId: m[x.to],
      projectId: x.project ? p[x.project] : null,
      issuedDate: day(x.issued),
      expectedReturnDate: x.expected === undefined ? null : day(x.expected),
      returnedDate: x.returned === undefined ? null : day(x.returned),
      conditionOnReturn: x.condition ?? null,
      notes: x.notes,
      createdAt: at(x.issued, 16),
    })),
  })

  // quantityIssued on project requirements = units currently out for that project
  // (random checkouts are only tagged with projects that list the component).
  const openByProject = await db.issuance.groupBy({
    by: ["projectId", "componentId"],
    where: { returnedDate: null, projectId: { not: null } },
    _sum: { quantity: true },
  })
  for (const row of openByProject) {
    await db.projectComponent.update({
      where: { projectId_componentId: { projectId: row.projectId!, componentId: row.componentId } },
      data: { quantityIssued: row._sum.quantity ?? 0 },
    })
  }

  // Sanity: stock invariants hold in the database, lost units left the total.
  const [components, issued, lost] = await Promise.all([
    db.component.findMany(),
    db.issuance.groupBy({ by: ["componentId"], where: { returnedDate: null }, _sum: { quantity: true } }),
    db.issuance.groupBy({ by: ["componentId"], where: { conditionOnReturn: "LOST" }, _sum: { quantity: true } }),
  ])
  const sum = (rows: typeof issued, id: string) => rows.find((r) => r.componentId === id)?._sum.quantity ?? 0
  const low: string[] = []
  for (const comp of components) {
    const src = COMPONENTS.find((x) => x.name === comp.name)!
    const initialTotal = src.working + (src.damaged ?? 0) + (src.repair ?? 0)
    const out = sum(issued, comp.id)
    if (comp.quantityWorking + comp.quantityDamaged + comp.quantityUnderRepair !== comp.quantityTotal) throw new Error(`Seed bug: ${comp.name} counts don't add up`)
    if (out > comp.quantityWorking) throw new Error(`Seed bug: ${comp.name} issued beyond working stock`)
    if (comp.quantityTotal !== initialTotal - sum(lost, comp.id)) throw new Error(`Seed bug: ${comp.name} lost units not removed from total`)
    if (comp.quantityWorking - out <= comp.lowStockThreshold) low.push(comp.name)
  }

  const counts = await Promise.all([
    db.member.count(),
    db.team.count(),
    db.project.count(),
    db.issuance.count(),
    db.issuance.count({ where: { returnedDate: null } }),
    db.issuance.count({ where: { returnedDate: null, expectedReturnDate: { lt: day(0) } } }),
    db.issuance.count({ where: { returnedDate: null, expectedReturnDate: { gte: day(0), lte: day(3) } } }),
    db.task.count(),
    db.progressUpdate.count(),
  ])
  console.log(
    `Seeded ${components.length} components, ${counts[0]} members, ${counts[1]} teams, ${counts[2]} projects, ` +
      `${counts[3]} issuances (${counts[4]} open, ${counts[5]} overdue, ${counts[6]} due within 3 days), ` +
      `${counts[7]} tasks, ${counts[8]} progress updates. Low stock: ${low.join(", ") || "none"}.`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
