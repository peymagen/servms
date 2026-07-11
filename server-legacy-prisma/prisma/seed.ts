import { PrismaClient, Role, Division } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function upsertUser(params: {
  employeeId: string;
  password: string;
  fullName: string;
  designation: string;
  role: Role;
  division?: Division;
}) {
  const passwordHash = await bcrypt.hash(params.password, 10);
  await prisma.user.upsert({
    where: { employeeId: params.employeeId },
    update: {},
    create: {
      employeeId: params.employeeId,
      passwordHash,
      fullName: params.fullName,
      designation: params.designation,
      role: params.role,
      division: params.division,
    },
  });
}

async function main() {
  await upsertUser({
    employeeId: "SER-HQ-0001",
    password: "SuperAdmin@123",
    fullName: "R. Mukherjee",
    designation: "Chief Admin",
    role: Role.SUPER_ADMIN,
  });

  await upsertUser({
    employeeId: "SER-ADM-4421",
    password: "Admin@123",
    fullName: "Arun Sharma",
    designation: "Assistant Comm. Manager",
    role: Role.ADMIN,
  });

  const divisionAdmins: Array<[Division, string, string]> = [
    [Division.ADRA, "SER-DIV-ADA1", "Pratik Patel"],
    [Division.RANCHI, "SER-DIV-RNC1", "Suman Nayak"],
    [Division.CHAKRADHARPUR, "SER-DIV-CKP1", "Rajesh Mukherji"],
    [Division.KHARAGPUR, "SER-DIV-KGP1", "Ankit Srivastava"],
  ];

  for (const [division, employeeId, fullName] of divisionAdmins) {
    await upsertUser({
      employeeId,
      password: "Division@123",
      fullName,
      designation: "Division Additional Admin",
      role: Role.DIVISION_ADDITIONAL_ADMIN,
      division,
    });
  }

  const contractorSeed = [
    {
      name: "Eastern Catering Services Pvt Ltd",
      licenseNumber: "SER/C&NI/2023/8821",
      division: Division.KHARAGPUR,
      validityDate: new Date("2025-10-12"),
    },
    {
      name: "Om Sai Catering Services",
      licenseNumber: "SER/C&NI/2023/4102",
      division: Division.ADRA,
      validityDate: new Date("2023-11-04"),
    },
    {
      name: "Jagdamba Vendor Alliance",
      licenseNumber: "SER/C&NI/2022/9903",
      division: Division.RANCHI,
      validityDate: new Date("2026-01-28"),
    },
    {
      name: "Rapid Rail Logistics",
      licenseNumber: "SER/C&NI/2023/5541",
      division: Division.CHAKRADHARPUR,
      validityDate: new Date("2024-08-15"),
    },
  ];

  const contractors = [];
  for (const c of contractorSeed) {
    const contractor = await prisma.contractor.upsert({
      where: { licenseNumber: c.licenseNumber },
      update: {},
      create: c,
    });
    contractors.push(contractor);
  }

  const vendorSeed = [
    {
      vendorCode: "SER-2024-V-0801",
      fullName: "Subhash Mahato",
      contractor: contractors[0],
      division: Division.KHARAGPUR,
      unitStation: "Kharagpur Division",
      vendorType: "Catering",
      aadhaarStatus: "VERIFIED" as const,
      medicalValidity: new Date("2025-12-12"),
    },
    {
      vendorCode: "SER-2024-V-1102",
      fullName: "Aruna Kumari",
      contractor: contractors[1],
      division: Division.ADRA,
      unitStation: "Adra Division",
      vendorType: "Pantry Services",
      aadhaarStatus: "VERIFIED" as const,
      medicalValidity: new Date("2023-10-01"),
    },
    {
      vendorCode: "SER-2024-V-0943",
      fullName: "Rajesh Jha",
      contractor: contractors[2],
      division: Division.RANCHI,
      unitStation: "Ranchi Division",
      vendorType: "Logistics",
      aadhaarStatus: "PENDING" as const,
      medicalValidity: new Date("2024-06-24"),
    },
    {
      vendorCode: "SER-2024-V-1288",
      fullName: "Bikash Khan",
      contractor: contractors[0],
      division: Division.KHARAGPUR,
      unitStation: "Kharagpur Division",
      vendorType: "Catering",
      aadhaarStatus: "VERIFIED" as const,
      medicalValidity: new Date("2026-02-02"),
    },
  ];

  const vendors = [];
  for (const v of vendorSeed) {
    const vendor = await prisma.vendor.upsert({
      where: { vendorCode: v.vendorCode },
      update: {},
      create: {
        vendorCode: v.vendorCode,
        fullName: v.fullName,
        contractorId: v.contractor.id,
        division: v.division,
        unitStation: v.unitStation,
        vendorType: v.vendorType,
        aadhaarStatus: v.aadhaarStatus,
        medicalValidity: v.medicalValidity,
      },
    });
    vendors.push(vendor);
  }

  const unitSeed = [
    {
      unitCode: "HWH-PF1-F01",
      unitName: "Amul Milk Parlour",
      station: "Howrah Jn",
      platformLocation: "PF 1",
      division: Division.KHARAGPUR,
      clusterName: "Food Plaza West",
      contractType: "LONG_TERM",
      inspectorName: "Ankit Srivastava",
      status: "ACTIVE" as const,
    },
    {
      unitCode: "TATA-PF3-K04",
      unitName: "Indian Coffee House",
      station: "Tatanagar",
      platformLocation: "PF 3",
      division: Division.CHAKRADHARPUR,
      clusterName: "General Stalls",
      contractType: "LONG_TERM",
      inspectorName: "Rajesh Mukherji",
      status: "ACTIVE" as const,
    },
    {
      unitCode: "KGP-PF4-T02",
      unitName: "Book World Express",
      station: "Kharagpur",
      platformLocation: "PF 4",
      division: Division.KHARAGPUR,
      clusterName: "Waiting Hall C",
      contractType: "SHORT_TERM",
      inspectorName: "Ankit Srivastava",
      status: "EXPIRING" as const,
    },
    {
      unitCode: "ADA-PF1-W01",
      unitName: "Adra Waiting Hall Stall",
      station: "Adra",
      platformLocation: "PF 1",
      division: Division.ADRA,
      clusterName: "Waiting Hall C",
      contractType: "LONG_TERM",
      inspectorName: null,
      status: "PENDING" as const,
    },
    {
      unitCode: "RNC-PF4-N01",
      unitName: "Ranchi North Gate Kiosk",
      station: "Ranchi",
      platformLocation: "PF 4",
      division: Division.RANCHI,
      clusterName: "North Gate",
      contractType: "LONG_TERM",
      inspectorName: "Suman Nayak",
      status: "ACTIVE" as const,
    },
  ];

  for (const u of unitSeed) {
    await prisma.unit.upsert({
      where: { unitCode: u.unitCode },
      update: {},
      create: u,
    });
  }

  const complaintSeed = [
    {
      unitStation: "Kharagpur Junction (KGP)",
      category: "Food Quality & Hygiene",
      description: "Stale food reported at platform 4 catering stall.",
      division: Division.KHARAGPUR,
      priority: "HIGH" as const,
      status: "PENDING" as const,
      occurrenceDate: new Date("2023-10-24"),
    },
    {
      unitStation: "Tatanagar (TATA)",
      category: "Overcharging",
      description: "Vendor charged above MRP for bottled water.",
      division: Division.CHAKRADHARPUR,
      priority: "MEDIUM" as const,
      status: "UNDER_INVESTIGATION" as const,
      occurrenceDate: new Date("2023-10-23"),
    },
    {
      unitStation: "Adra (ADA)",
      category: "Vendor Misbehavior",
      description: "Passenger reported rude behavior from stall attendant.",
      division: Division.ADRA,
      priority: "LOW" as const,
      status: "RESOLVED" as const,
      occurrenceDate: new Date("2023-10-22"),
    },
  ];

  for (const c of complaintSeed) {
    const existing = await prisma.complaint.findFirst({
      where: { unitStation: c.unitStation, category: c.category },
    });
    if (!existing) {
      await prisma.complaint.create({ data: c });
    }
  }

  const penaltySeed = [
    {
      refNo: "PNL-2024-0812",
      vendor: vendors[0],
      unitLocation: "KGP Division",
      division: Division.KHARAGPUR,
      penaltyType: "Hygiene Lapse",
      amount: 25000,
      status: "RECOVERED" as const,
    },
    {
      refNo: "PNL-2024-0815",
      vendor: vendors[3],
      unitLocation: "TATA Junction",
      division: Division.CHAKRADHARPUR,
      penaltyType: "Overcharging",
      amount: 12500,
      status: "PENDING" as const,
    },
    {
      refNo: "PNL-2024-0760",
      vendor: vendors[1],
      unitLocation: "HWH Station",
      division: Division.ADRA,
      penaltyType: "Illegal Vending",
      amount: 50000,
      status: "OVERDUE" as const,
    },
  ];

  for (const p of penaltySeed) {
    await prisma.penalty.upsert({
      where: { refNo: p.refNo },
      update: {},
      create: {
        refNo: p.refNo,
        vendorId: p.vendor.id,
        vendorName: p.vendor.fullName,
        unitLocation: p.unitLocation,
        division: p.division,
        penaltyType: p.penaltyType,
        amount: p.amount,
        status: p.status,
      },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
