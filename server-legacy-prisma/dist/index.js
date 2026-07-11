"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_1 = require("./routes/auth");
const users_1 = require("./routes/users");
const dashboard_1 = require("./routes/dashboard");
const contractors_1 = require("./routes/contractors");
const vendors_1 = require("./routes/vendors");
const units_1 = require("./routes/units");
const complaints_1 = require("./routes/complaints");
const penalties_1 = require("./routes/penalties");
const reports_1 = require("./routes/reports");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use("/api/auth", auth_1.authRouter);
app.use("/api/users", users_1.usersRouter);
app.use("/api/dashboard", dashboard_1.dashboardRouter);
app.use("/api/contractors", contractors_1.contractorsRouter);
app.use("/api/vendors", vendors_1.vendorsRouter);
app.use("/api/units", units_1.unitsRouter);
app.use("/api/complaints", complaints_1.complaintsRouter);
app.use("/api/penalties", penalties_1.penaltiesRouter);
app.use("/api/reports", reports_1.reportsRouter);
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, () => {
    console.log(`SERVMS API listening on http://localhost:${PORT}`);
});
//# sourceMappingURL=index.js.map