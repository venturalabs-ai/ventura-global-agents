## 2024-05-19 - [Fix N+1 sequential await in loops]
**Learning:** Sequential `await` in loops (like `for...of`) is a major performance bottleneck for independent API calls (e.g. OpenAI API `getEmbedding`).
**Action:** Always map the loop content into promises and use `await Promise.all()` for concurrent fetching. Remember to also sort properly if logic relied on sequential execution order.
