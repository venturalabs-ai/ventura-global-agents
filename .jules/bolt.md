## 2024-09-06 - [Avoid chained array allocations in V8 for high-throughput structures]
**Learning:** Chaining array methods like `[...Map.values()].filter().map().filter()` creates significant memory allocations and redundant iterations, causing GC overhead that is problematic on high-frequency infrastructure like the EventBus and Registry.
**Action:** Replace spreading Maps and Sets and chained array iterators with explicit `for..of` loops when doing data filtering, mapping, or collection in high-frequency platform paths.
