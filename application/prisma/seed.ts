import "dotenv/config";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

const dbPath = `file:${path.join(process.cwd(), "dev.db")}`;
const adapter = new PrismaBetterSqlite3({ url: dbPath });
const prisma = new PrismaClient({ adapter });

// ─────────────────────────────────────────
// Migration matrices from Chapter 4 of the research document
// Rows: from-state (index 0 = Rating 1 / default)
// Cols: to-state  (index 0 = Rating 1 / default)
// ─────────────────────────────────────────

// M_normal — Table 4.4 (estimated from normal-regime transitions, n=31)
const M_NORMAL: number[][] = [
  [1.000, 0.000, 0.000, 0.000, 0.000], // State 1 (absorbing default)
  [0.167, 0.500, 0.333, 0.000, 0.000], // State 2
  [0.000, 0.100, 0.700, 0.200, 0.000], // State 3
  [0.000, 0.000, 0.200, 0.800, 0.000], // State 4
  [0.000, 0.000, 0.100, 0.200, 0.700], // State 5 (Dirichlet prior — not observed)
];

// M_stress — Table 4.5 (estimated from stress-regime transitions, n=20)
// States 4 & 5 rows use Dirichlet MAP prior (no observed stress transitions)
const M_STRESS: number[][] = [
  [1.000, 0.000, 0.000, 0.000, 0.000], // State 1 (absorbing default)
  [0.125, 0.813, 0.063, 0.000, 0.000], // State 2
  [0.000, 0.750, 0.250, 0.000, 0.000], // State 3
  [0.167, 0.167, 0.333, 0.333, 0.000], // State 4 (Dirichlet prior *)
  [0.100, 0.100, 0.200, 0.300, 0.300], // State 5 (Dirichlet prior *)
];

// Logistic switching parameters (§4.4, bootstrap CI in document)
const KAPPA = 1.25;   // sharpness — 95% CI [0.92, 1.58]
const GAMMA_0 = -1.10; // threshold — 95% CI [−1.38, −0.82]

async function main() {
  console.log("🌱 Seeding database...");

  // ── 1. Admin user ─────────────────────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@agrifin.local";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "changeme123";

  const existingAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
  });

  if (!existingAdmin) {
    const hashed = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        name: "Admin",
        email: adminEmail,
        password: hashed,
        role: "ADMIN",
      },
    });
    console.log(`✅ Admin created: ${adminEmail}`);
  } else {
    console.log(`ℹ️  Admin already exists (${existingAdmin.email}), skipping.`);
  }

  // ── 2. Migration matrices ─────────────────────────────────────────────────
  const existingMatrices = await prisma.migrationMatrix.count();

  if (existingMatrices === 0) {
    await prisma.migrationMatrix.createMany({
      data: [
        {
          matrixType: "NORMAL",
          kappa: KAPPA,
          gamma0: GAMMA_0,
          matrixData: JSON.stringify(M_NORMAL),
          source: "ESTIMATED",
        },
        {
          matrixType: "STRESS",
          kappa: KAPPA,
          gamma0: GAMMA_0,
          matrixData: JSON.stringify(M_STRESS),
          source: "ESTIMATED",
        },
      ],
    });
    console.log("✅ Migration matrices seeded (M_normal + M_stress).");
  } else {
    console.log("ℹ️  Migration matrices already present, skipping.");
  }

  console.log("🌱 Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
