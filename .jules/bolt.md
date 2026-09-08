## 2024-10-18 - Fast Graph Edge Lookups
**Learning:** Storing edges in a flat array results in O(E) time complexity for `neighbors()` traversals, which becomes a bottleneck in graph operations.
**Action:** Use an adjacency list (`Map<string, Edge[]>`) to index edges by their source node, turning traversal lookups into O(1) operations (O(K) overall for K neighbors).
