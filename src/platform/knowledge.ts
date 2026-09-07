export type Ontology = Readonly<{ entityTypes: readonly string[]; relations: Readonly<Record<string, readonly string[]>> }>;
export type Entity = Readonly<{ id: string; type: string; attributes?: Readonly<Record<string, unknown>> }>;
export type Edge = Readonly<{ from: string; relation: string; to: string }>;
export class KnowledgeGraph {
  private readonly entities = new Map<string, Entity>(); private readonly edges: Edge[] = [];
  // Optimization: Pre-compute outgoing edges per entity for O(1) neighbor lookups
  // Impact: Reduces neighbors() complexity from O(N) to O(E) where E is node degree
  private readonly outEdges = new Map<string, Edge[]>();
  constructor(private readonly ontology: Ontology) {}
  addEntity(entity: Entity): void {
    if (!this.ontology.entityTypes.includes(entity.type)) throw new Error(`unknown entity type: ${entity.type}`);
    this.entities.set(entity.id, entity);
  }
  connect(edge: Edge): void {
    const from = this.entities.get(edge.from); const to = this.entities.get(edge.to);
    if (!from || !to) throw new Error("both entities must exist");
    if (!(this.ontology.relations[from.type] ?? []).includes(edge.relation)) throw new Error(`relation ${edge.relation} is not allowed for ${from.type}`);
    this.edges.push(edge);

    // Maintain adjacency list for O(1) retrieval
    let adj = this.outEdges.get(edge.from);
    if (!adj) {
      adj = [];
      this.outEdges.set(edge.from, adj);
    }
    adj.push(edge);
  }
  neighbors(id: string, relation?: string): readonly Entity[] {
    const edges = this.outEdges.get(id) || [];
    return edges.filter((edge) => (!relation || edge.relation === relation)).map((edge) => this.entities.get(edge.to)).filter((entity): entity is Entity => Boolean(entity));
  }
}
