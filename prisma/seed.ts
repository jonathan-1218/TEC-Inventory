/**
 * Seeds realistic TEC club data. Wipes existing rows first.
 *   npm run db:seed               -> reset + seed
 *   tsx prisma/seed.ts --if-empty -> only seed a fresh database (used by `npm run dev`)
 * Dates are relative to today so overdue returns and timelines always look current.
 */
import { existsSync } from "node:fs"
import { PrismaClient, type Category, type Designation } from "@prisma/client"

// Prisma only auto-loads .env if it existed when the client was generated (not true on a fresh
// `npm install`), so load it here. Variables already set in the environment win.
if (existsSync(".env")) process.loadEnvFile(".env")

const db = new PrismaClient()

/** Calendar date `offset` days from today, stored at 12:00 UTC like the app does. */
function day(offset: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return new Date(`${d.toLocaleDateString("en-CA")}T12:00:00Z`)
}

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
  { key: "uno", name: "Arduino Uno R3", modelNumber: "A000066", category: "MICROCONTROLLER", description: "ATmega328P board, 14 digital I/O, 6 analog inputs. The club's default starter board.", working: 10, damaged: 1, repair: 1, location: "Shelf A1", unitCost: 650, datasheetUrl: "https://docs.arduino.cc/hardware/uno-rev3/", lowStockThreshold: 3 },
  { key: "esp32", name: "ESP32 DevKit V1", modelNumber: "ESP32-WROOM-32", category: "MICROCONTROLLER", description: "Dual-core 240 MHz MCU with Wi-Fi and Bluetooth. 30-pin DOIT board.", working: 14, damaged: 1, location: "Shelf A1", unitCost: 450, datasheetUrl: "https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32_datasheet_en.pdf", lowStockThreshold: 4 },
  { key: "rpi4", name: "Raspberry Pi 4 Model B (4GB)", modelNumber: "RPI4-MODBP-4GB", category: "MICROCONTROLLER", description: "Quad-core Cortex-A72 SBC. Comes with 32 GB microSD and official USB-C supply.", working: 4, location: "Locked cabinet C1", unitCost: 5500, datasheetUrl: "https://datasheets.raspberrypi.com/rpi4/raspberry-pi-4-datasheet.pdf", lowStockThreshold: 1, notes: "Issue only to core members; log SD card image used." },
  { key: "hcsr04", name: "HC-SR04 Ultrasonic Sensor", modelNumber: "HC-SR04", category: "SENSOR", description: "2 cm – 400 cm ranging module, 5 V.", working: 18, damaged: 2, location: "Box B3", unitCost: 60, lowStockThreshold: 5 },
  { key: "mpu6050", name: "MPU6050 6-Axis IMU", modelNumber: "GY-521", category: "SENSOR", description: "3-axis gyro + 3-axis accelerometer over I²C.", working: 9, repair: 1, location: "Box B3", unitCost: 150, datasheetUrl: "https://invensense.tdk.com/wp-content/uploads/2015/02/MPU-6000-Datasheet1.pdf", lowStockThreshold: 3, notes: "One unit has a cracked header — resoldering." },
  { key: "dht22", name: "DHT22 Temperature & Humidity Sensor", modelNumber: "AM2302", category: "SENSOR", description: "±0.5 °C, 0–100 % RH, single-wire digital output.", working: 4, location: "Box B3", unitCost: 280, lowStockThreshold: 2 },
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
  { key: "dmm", name: "Digital Multimeter", modelNumber: "DT830D", category: "TOOL", description: "Voltage, current, resistance, continuity.", working: 3, repair: 1, location: "Shelf T1", unitCost: 450, lowStockThreshold: 1 },
]

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
  { key: "vikram", name: "Vikram Singh", rollNumber: "25ME012", department: "Mechanical", yearOfStudy: 2, designation: "CORE_MEMBER" },
  { key: "priya", name: "Priya Das", rollNumber: "25CS051", department: "Computer Science", yearOfStudy: 2, designation: "MEMBER", isActive: false },
  { key: "arjun", name: "Arjun Patel", rollNumber: "26EC006", department: "Electronics & Communication", yearOfStudy: 1, designation: "MEMBER" },
  { key: "meera", name: "Meera Krishnan", rollNumber: "26CS029", department: "Computer Science", yearOfStudy: 1, designation: "MEMBER" },
]

async function main() {
  if (process.argv.includes("--if-empty") && (await db.component.count()) > 0) {
    console.log("Database already has data — skipping seed.")
    return
  }

  // Children first (SQLite + Postgres safe order).
  await db.issuance.deleteMany()
  await db.progressUpdate.deleteMany()
  await db.projectComponent.deleteMany()
  await db.projectMember.deleteMany()
  await db.teamMember.deleteMany()
  await db.project.deleteMany()
  await db.team.deleteMany()
  await db.member.deleteMany()
  await db.component.deleteMany()

  const c: Record<string, string> = {}
  for (const x of COMPONENTS) {
    const damaged = x.damaged ?? 0
    const repair = x.repair ?? 0
    const row = await db.component.create({
      data: {
        name: x.name,
        modelNumber: x.modelNumber,
        category: x.category,
        description: x.description,
        quantityWorking: x.working,
        quantityDamaged: damaged,
        quantityUnderRepair: repair,
        quantityTotal: x.working + damaged + repair,
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

  const robotics = await db.team.create({
    data: {
      name: "Robotics",
      description: "Mobile robots, manipulators and anything with motors. Builds the club's competition rovers.",
      members: {
        create: [
          { memberId: m.vikram, roleInTeam: "Team Lead" },
          { memberId: m.diya, roleInTeam: "Hardware" },
          { memberId: m.rohan, roleInTeam: "Software" },
          { memberId: m.arjun, roleInTeam: "Hardware" },
          { memberId: m.aarav, roleInTeam: "Mentor" },
        ],
      },
    },
  })

  const iot = await db.team.create({
    data: {
      name: "IoT & Embedded",
      description: "Connected sensors, low-power devices and the smart-campus initiative.",
      members: {
        create: [
          { memberId: m.ananya, roleInTeam: "Team Lead" },
          { memberId: m.sneha, roleInTeam: "Hardware" },
          { memberId: m.karthik, roleInTeam: "Software" },
          { memberId: m.meera, roleInTeam: "Software" },
          { memberId: m.priya, roleInTeam: "Cloud" },
        ],
      },
    },
  })

  const rover = await db.project.create({
    data: {
      title: "Autonomous Line-Following Rover",
      description:
        "A four-wheel rover that follows a taped track, avoids obstacles with ultrasonic ranging and holds heading with an IMU. Target: inter-college robotics meet.",
      teamId: robotics.id,
      status: "IN_PROGRESS",
      progressPercent: 65,
      startDate: day(-72),
      targetDate: day(34),
      techStack: {
        languages: ["C++", "Python"],
        frameworks: ["Arduino", "ROS 2"],
        hardware: ["Arduino Uno R3", "L298N", "HC-SR04", "MPU6050", "BO motors"],
        tools: ["PlatformIO", "KiCad", "Fusion 360"],
        cloud: [],
      },
      members: {
        create: [
          { memberId: m.vikram, roleInProject: "Project Lead" },
          { memberId: m.rohan, roleInProject: "Firmware" },
          { memberId: m.arjun, roleInProject: "Chassis & Wiring" },
        ],
      },
      progressUpdates: {
        create: [
          { date: day(-70), percentAtUpdate: 10, updatedByMemberId: m.vikram, note: "Kickoff. Finalised chassis layout and bill of materials." },
          { date: day(-52), percentAtUpdate: 30, updatedByMemberId: m.arjun, note: "Chassis 3D-printed. Motors and L298N wired and bench-tested." },
          { date: day(-29), percentAtUpdate: 50, updatedByMemberId: m.rohan, note: "IR line sensing working on the practice track. PID tuning started." },
          { date: day(-11), percentAtUpdate: 65, updatedByMemberId: m.rohan, note: "Obstacle avoidance with HC-SR04 integrated. IMU heading correction in progress." },
        ],
      },
      components: {
        create: [
          { componentId: c.uno, quantityRequired: 2 },
          { componentId: c.l298n, quantityRequired: 2 },
          { componentId: c.hcsr04, quantityRequired: 3 },
          { componentId: c.mpu6050, quantityRequired: 1 },
          { componentId: c.bo, quantityRequired: 4 },
          { componentId: c.cell18650, quantityRequired: 3 },
        ],
      },
    },
  })

  const garden = await db.project.create({
    data: {
      title: "Smart Campus Garden Monitor",
      description:
        "Solar-powered ESP32 nodes that report soil moisture, temperature and humidity from the campus garden to a live dashboard, with alerts when beds need watering.",
      teamId: iot.id,
      status: "IN_PROGRESS",
      progressPercent: 40,
      startDate: day(-55),
      targetDate: day(50),
      techStack: {
        languages: ["C++", "TypeScript"],
        frameworks: ["Arduino-ESP32", "Next.js"],
        hardware: ["ESP32 DevKit V1", "DHT22", "Capacitive soil sensor", "SSD1306 OLED"],
        tools: ["VS Code", "Grafana"],
        cloud: ["HiveMQ MQTT", "Firebase"],
      },
      members: {
        create: [
          { memberId: m.ananya, roleInProject: "Project Lead" },
          { memberId: m.karthik, roleInProject: "Backend" },
          { memberId: m.meera, roleInProject: "Dashboard" },
          { memberId: m.sneha, roleInProject: "Sensors & Power" },
        ],
      },
      progressUpdates: {
        create: [
          { date: day(-53), percentAtUpdate: 5, updatedByMemberId: m.ananya, note: "Requirements agreed with the horticulture club. Sensor shortlist done." },
          { date: day(-36), percentAtUpdate: 20, updatedByMemberId: m.karthik, note: "ESP32 publishing DHT22 readings over MQTT every 60 s." },
          { date: day(-16), percentAtUpdate: 40, updatedByMemberId: m.sneha, note: "Solar + 18650 power prototype running 3 days unattended. Dashboard skeleton up." },
        ],
      },
      components: {
        create: [
          { componentId: c.esp32, quantityRequired: 3 },
          { componentId: c.dht22, quantityRequired: 3 },
          { componentId: c.oled, quantityRequired: 2 },
          { componentId: c.cell18650, quantityRequired: 4 },
          { componentId: c.lm2596, quantityRequired: 2 },
        ],
      },
    },
  })

  const arm = await db.project.create({
    data: {
      title: "Gesture-Controlled Robotic Arm",
      description:
        "A 4-DOF servo arm driven by a glove-mounted MPU6050 over Bluetooth. Built as an open-house demo — no team, just two members who wanted to build it.",
      teamId: null,
      status: "COMPLETED",
      progressPercent: 100,
      startDate: day(-200),
      targetDate: day(-130),
      techStack: {
        languages: ["C++"],
        frameworks: ["Arduino"],
        hardware: ["Arduino Uno R3", "MPU6050", "SG90", "HC-05"],
        tools: ["Tinkercad", "Fusion 360"],
        cloud: [],
      },
      members: {
        create: [
          { memberId: m.diya, roleInProject: "Project Lead" },
          { memberId: m.priya, roleInProject: "Firmware" },
        ],
      },
      progressUpdates: {
        create: [
          { date: day(-198), percentAtUpdate: 10, updatedByMemberId: m.diya, note: "Arm geometry sketched; servo torque budget checked." },
          { date: day(-170), percentAtUpdate: 45, updatedByMemberId: m.priya, note: "Glove IMU angles mapped to servo positions over HC-05." },
          { date: day(-146), percentAtUpdate: 80, updatedByMemberId: m.diya, note: "Gripper redesigned; jitter fixed with a complementary filter." },
          { date: day(-133), percentAtUpdate: 100, updatedByMemberId: m.diya, note: "Demoed at open house. Parts returned to inventory." },
        ],
      },
      components: {
        create: [
          { componentId: c.sg90, quantityRequired: 4 },
          { componentId: c.hc05, quantityRequired: 2 },
          { componentId: c.mpu6050, quantityRequired: 1 },
          { componentId: c.uno, quantityRequired: 1 },
        ],
      },
    },
  })

  // Open issuances (some overdue) and some returned history.
  type I = {
    comp: string
    qty: number
    to: string
    project?: string
    issued: number
    expected?: number
    returned?: number
    condition?: "WORKING" | "DAMAGED" | "LOST"
    notes?: string
  }
  const ISSUANCES: I[] = [
    { comp: "uno", qty: 2, to: "rohan", project: rover.id, issued: -60, expected: 34 },
    { comp: "l298n", qty: 2, to: "arjun", project: rover.id, issued: -55, expected: 34 },
    { comp: "hcsr04", qty: 3, to: "arjun", project: rover.id, issued: -30, expected: 34 },
    { comp: "bo", qty: 4, to: "vikram", project: rover.id, issued: -55, expected: 34 },
    { comp: "esp32", qty: 3, to: "karthik", project: garden.id, issued: -40, expected: 50 },
    { comp: "dht22", qty: 2, to: "sneha", project: garden.id, issued: -38, expected: 50 },
    { comp: "cell18650", qty: 4, to: "sneha", project: garden.id, issued: -25, expected: -4, notes: "Solar prototype endurance test" },
    { comp: "oled", qty: 1, to: "meera", project: garden.id, issued: -20, expected: -6 },
    { comp: "dmm", qty: 1, to: "aarav", issued: -18, expected: -11, notes: "Workshop prep" },
    { comp: "breadboard", qty: 5, to: "diya", issued: -3, expected: 4, notes: "Arduino 101 workshop for first-years" },
    // Returned history
    { comp: "sg90", qty: 3, to: "diya", project: arm.id, issued: -196, expected: -130, returned: -131, condition: "WORKING" },
    { comp: "sg90", qty: 1, to: "diya", project: arm.id, issued: -196, expected: -130, returned: -131, condition: "DAMAGED", notes: "Return: stripped gear" },
    { comp: "hc05", qty: 2, to: "priya", project: arm.id, issued: -175, expected: -130, returned: -131, condition: "WORKING" },
    { comp: "mpu6050", qty: 1, to: "priya", project: arm.id, issued: -175, expected: -130, returned: -128, condition: "WORKING" },
    { comp: "uno", qty: 1, to: "diya", project: arm.id, issued: -196, expected: -130, returned: -131, condition: "WORKING" },
    { comp: "esp32", qty: 1, to: "meera", issued: -90, expected: -60, returned: -58, condition: "LOST", notes: "Return: left at hackathon venue" },
    { comp: "mpu6050", qty: 1, to: "rohan", project: rover.id, issued: -45, expected: -20, returned: -21, condition: "WORKING", notes: "Return: swapped for a better-calibrated unit" },
  ]

  for (const x of ISSUANCES) {
    await db.issuance.create({
      data: {
        componentId: c[x.comp],
        quantity: x.qty,
        issuedToMemberId: m[x.to],
        projectId: x.project ?? null,
        issuedDate: day(x.issued),
        expectedReturnDate: x.expected === undefined ? null : day(x.expected),
        returnedDate: x.returned === undefined ? null : day(x.returned),
        conditionOnReturn: x.condition ?? null,
        notes: x.notes,
      },
    })
  }

  // quantityIssued on project requirements = units currently out for that project.
  const open = await db.issuance.groupBy({
    by: ["projectId", "componentId"],
    where: { returnedDate: null, projectId: { not: null } },
    _sum: { quantity: true },
  })
  for (const row of open) {
    await db.projectComponent.update({
      where: { projectId_componentId: { projectId: row.projectId!, componentId: row.componentId } },
      data: { quantityIssued: row._sum.quantity ?? 0 },
    })
  }

  // Sanity: nothing is issued beyond its working stock.
  const issued = await db.issuance.groupBy({
    by: ["componentId"],
    where: { returnedDate: null },
    _sum: { quantity: true },
  })
  for (const row of issued) {
    const comp = await db.component.findUniqueOrThrow({ where: { id: row.componentId } })
    if ((row._sum.quantity ?? 0) > comp.quantityWorking) {
      throw new Error(`Seed bug: ${comp.name} issued beyond working stock`)
    }
  }

  const counts = await Promise.all([
    db.component.count(),
    db.member.count(),
    db.team.count(),
    db.project.count(),
    db.issuance.count({ where: { returnedDate: null } }),
  ])
  console.log(
    `Seeded ${counts[0]} components, ${counts[1]} members, ${counts[2]} teams, ${counts[3]} projects, ${counts[4]} open issuances.`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
