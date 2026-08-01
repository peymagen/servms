import * as dashboardService from "./dashboard.service";
import { resolveDashboardScope, getHqToggleOptions, parseDashboardFilters } from "./dashboard.scope";
import { createResponse } from "../../common/helper/response.hepler";
import { logAudit } from "../../common/services/auditLog.service";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";
import { type DashboardGroupKey } from "./dashboard.service";

const GROUP_KEYS: DashboardGroupKey[] = ["units", "contractors", "vendors", "penalty", "pending_action"];

// A single fetch of the dashboard reshapes the view (HQ toggle) and/or filters
// together, so one combined audit row covers "Dashboard viewed" / "Filters
// applied" / "HQ toggle changes" rather than three near-duplicate rows per request.
export const getSummary = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const viewParam = req.query.view ? String(req.query.view) : undefined;
  const scope = await resolveDashboardScope(user, viewParam);
  const filters = parseDashboardFilters(req.query as Record<string, unknown>);

  const result = await dashboardService.getDashboardSummary(scope, filters);

  const { view, ...otherQueryParams } = req.query;
  await logAudit({
    req,
    module: "dashboard",
    action: "VIEW",
    details: `Dashboard viewed (view=${scope.view}${
      Object.keys(otherQueryParams).length ? `, filters=${JSON.stringify(otherQueryParams)}` : ""
    })`,
  });

  res.send(createResponse(result));
});

export const getGraphData = asyncHandler(async (req: Request, res: Response) => {
  const group = req.params.group as DashboardGroupKey;
  if (!GROUP_KEYS.includes(group)) {
    res.status(400).send(createResponse(null, "Invalid dashboard group"));
    return;
  }

  const user = req.user as any;
  const viewParam = req.query.view ? String(req.query.view) : undefined;
  const scope = await resolveDashboardScope(user, viewParam);
  const filters = parseDashboardFilters(req.query as Record<string, unknown>);

  const result = await dashboardService.getGroupGraphData(group, scope, filters);
  await logAudit({ req, module: "dashboard_graph", action: "VIEW", recordId: group, details: "Graph opened" });
  res.send(createResponse(result));
});

export const getToggleOptions = asyncHandler(async (_req: Request, res: Response) => {
  const options = await getHqToggleOptions();
  res.send(createResponse(options));
});

// Client-reported interactions that don't otherwise cause a distinct API call
// (clicking a critical alert or a subgroup navigates straight to another
// module's listing page) — logged here just before the client navigates away.
export const trackInteraction = asyncHandler(async (req: Request, res: Response) => {
  const { action, details } = req.body as { action?: string; details?: string };
  const allowed = ["alert_click", "subgroup_click", "report_open"];
  if (!action || !allowed.includes(action)) {
    res.status(400).send(createResponse(null, "Invalid interaction action"));
    return;
  }
  await logAudit({ req, module: "dashboard", action: "VIEW", details: `${action}${details ? `: ${details}` : ""}` });
  res.send(createResponse({ tracked: true }));
});
