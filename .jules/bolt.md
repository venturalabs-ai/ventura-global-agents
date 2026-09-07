## 2024-03-05 - [KnowledgeGraph Neighbors Optimization]
**Learning:** The KnowledgeGraph `neighbors()` method originally used an O(N) array filter across all edges, which is a major bottleneck for large graphs. Adding an adjacency list (`outEdges`) allows O(E) traversal (where E is out-degree) while keeping the API unchanged.
**Action:** Always maintain an adjacency list or dictionary for quick edge lookups in graph-like data structures rather than scanning all connections.
