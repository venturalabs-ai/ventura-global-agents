export type ApprovalStatus = "pending" | "approved" | "rejected";
export type Approval = Readonly<{ id: string; runId: string; reason: string; status: ApprovalStatus; decidedBy?: string }>;
export class ApprovalQueue {
  private readonly approvals = new Map<string, Approval>();
  request(runId: string, reason: string): Approval {
    if (!runId.trim() || !reason.trim()) throw new Error("runId and reason are required");
    const approval: Approval = { id: crypto.randomUUID(), runId, reason, status: "pending" }; this.approvals.set(approval.id, approval); return approval;
  }
  decide(id: string, status: Exclude<ApprovalStatus, "pending">, decidedBy: string): Approval {
    const current = this.approvals.get(id); if (!current || current.status !== "pending") throw new Error("pending approval not found");
    if (!decidedBy.trim()) throw new Error("decidedBy is required");
    const decision: Approval = { ...current, status, decidedBy }; this.approvals.set(id, decision); return decision;
  }
  pending(): readonly Approval[] { return [...this.approvals.values()].filter((approval) => approval.status === "pending"); }
}
