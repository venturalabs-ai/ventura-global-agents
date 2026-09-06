export type AgentRegistration = Readonly<{ id: string; version: string; capabilities: readonly string[]; endpoint: string; status: "active" | "draining" | "offline" }>;
export class AgentRegistry {
  private readonly registrations = new Map<string, AgentRegistration>();
  register(agent: AgentRegistration): void {
    if (!agent.id.trim() || !/^\d+\.\d+\.\d+$/.test(agent.version)) throw new Error("valid id and semantic version are required");
    if (!agent.capabilities.length || !agent.endpoint.startsWith("http")) throw new Error("capabilities and HTTP endpoint are required");
    this.registrations.set(`${agent.id}@${agent.version}`, agent);
  }
  resolve(capability: string): readonly AgentRegistration[] {
    // ⚡ Bolt: Replaced [...Map.values()].filter() with a for..of loop.
    // Expected impact: Eliminates one full array clone of registrations before filtering, reducing GC pressure.
    const result: AgentRegistration[] = [];
    for (const agent of this.registrations.values()) {
      if (agent.status === "active" && agent.capabilities.includes(capability)) result.push(agent);
    }
    return result;
  }
}
