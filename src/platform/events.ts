export type DomainEvent<T = unknown> = Readonly<{ id: string; type: string; occurredAt: string; payload: T }>;
export type EventHandler<T = unknown> = (event: DomainEvent<T>) => void | Promise<void>;
export class EventBus {
  private readonly handlers = new Map<string, Set<EventHandler>>();
  private readonly processed = new Set<string>();
  subscribe<T>(type: string, handler: EventHandler<T>): () => void {
    const handlers = this.handlers.get(type) ?? new Set<EventHandler>();
    handlers.add(handler as EventHandler); this.handlers.set(type, handlers);
    return () => handlers.delete(handler as EventHandler);
  }
  async publish<T>(event: DomainEvent<T>): Promise<boolean> {
    if (this.processed.has(event.id)) return false;
    this.processed.add(event.id);
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      // ⚡ Bolt: Removed [...Set].map() chaining to avoid intermediate array allocations.
      // Expected impact: Eliminates one full array clone on every event dispatch, significantly reducing GC pressure.
      const promises: (void | Promise<void>)[] = [];
      for (const handler of handlers) promises.push(handler(event));
      await Promise.all(promises);
    }
    return true;
  }
}
