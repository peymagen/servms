import * as clusterService from "./cluster.service";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";
import { isDivisionScoped, assertRecordAccessible, pinToOwnDivision } from "../../common/constants/roles";
import { logAudit } from "../../common/services/auditLog.service";
import createHttpError from "http-errors";

// Loads the cluster named by :id and applies the caller's division scope.
const loadAccessibleCluster = async (req: Request) => {
  const record = await clusterService.getClusterById(req.params.id as string);
  if (!record) throw createHttpError(404, "Cluster not found");
  assertRecordAccessible(req.user as any, record);
  return record;
};

export const createCluster = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  pinToOwnDivision(req.user as any, req.body);
  const result = await clusterService.createCluster(req.body, userId);
  await logAudit({ req, module: "cluster", recordId: result.id, action: "CREATE", newData: req.body });
  res.send(createResponse(result, "Cluster created successfully"));
});

export const getClusters = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  let division_id = req.query.division_id ? Number(req.query.division_id) : undefined;
  if (isDivisionScoped(user?.role_name)) {
    division_id = user.division_id;
  }
  const result = await clusterService.getClusters({
    limit: req.query.limit ? Number(req.query.limit) : 10,
    offset: req.query.offset ? Number(req.query.offset) : 0,
    search: req.query.search ? String(req.query.search) : undefined,
    cluster_type: req.query.cluster_type ? String(req.query.cluster_type) : undefined,
    division_id,
  });
  res.send(createResponse(result));
});

export const getClusterById = asyncHandler(async (req: Request, res: Response) => {
  const result = await loadAccessibleCluster(req);
  res.send(createResponse(result));
});

export const editCluster = asyncHandler(async (req: Request, res: Response) => {
  const oldData = await loadAccessibleCluster(req);
  pinToOwnDivision(req.user as any, req.body);
  const result = await clusterService.editCluster(req.params.id as string, req.body);
  await logAudit({ req, module: "cluster", recordId: req.params.id, action: "UPDATE", oldData, newData: req.body });
  res.send(createResponse(result, "Cluster updated successfully"));
});

export const deleteCluster = asyncHandler(async (req: Request, res: Response) => {
  await loadAccessibleCluster(req);
  const result = await clusterService.deleteCluster(req.params.id as string);
  await logAudit({ req, module: "cluster", recordId: req.params.id, action: "DELETE" });
  res.send(createResponse(result, "Cluster deactivated successfully"));
});
