export type Ontology = Readonly<{ entityTypes: readonly string[]; relations: Readonly<Record<string, readonly string[]>> }>;
export type Entity = Readonly<{ id: string; type: string; attributes?: Readonly<Record<string, unknown>> }>;
export type Edge = Readonly<{ from: string; relation: string; to: string }>;
export class KnowledgeGraph {
  private readonly entities = new Map<string, Entity>(); private readonly edges: Edge[] = [];
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
  }
  neighbors(id: string, relation?: string): readonly Entity[] {
    // ⚡ Bolt: Replaced chained .filter().map().filter() with a single for..of loop.
    // Expected impact: Eliminates three intermediate array allocations and redundant iterations.
    const result: Entity[] = [];
    for (const edge of this.edges) {
      if (edge.from === id && (!relation || edge.relation === relation)) {
        const entity = this.entities.get(edge.to);
        if (entity) result.push(entity);
      }
    }
    return result;
  }
}
