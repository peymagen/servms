import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth";
import { usersRouter } from "./routes/users";
import { dashboardRouter } from "./routes/dashboard";
import { contractorsRouter } from "./routes/contractors";
import { vendorsRouter } from "./routes/vendors";
import { unitsRouter } from "./routes/units";
import { complaintsRouter } from "./routes/complaints";
import { penaltiesRouter } from "./routes/penalties";
import { reportsRouter } from "./routes/reports";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/contractors", contractorsRouter);
app.use("/api/vendors", vendorsRouter);
app.use("/api/units", unitsRouter);
app.use("/api/complaints", complaintsRouter);
app.use("/api/penalties", penaltiesRouter);
app.use("/api/reports", reportsRouter);

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, () => {
  console.log(`SERVMS API listening on http://localhost:${PORT}`);
});
