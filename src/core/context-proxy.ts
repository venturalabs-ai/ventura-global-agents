// src/core/context-proxy.ts

import { Redis } from 'ioredis';
import { OpenAI } from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';
import { z } from 'zod';

/**
 * Compressed State Schema
 */
const CompressedStateSchema = z.object({
  agentId: z.string(),
  sessionId: z.string(),
  phase: z.string(),
  current: z.object({
    pendingApprovals: z.array(z.string()),
    activeIssues: z.array(z.string()),
    keyDecisions: z.array(z.any()).max(5), // Only last 5
  }),
  metadata: z.object({
    totalMessages: z.number(),
    totalCost: z.number(),
    lastUpdated: z.string(),
  }),
  evidence: z.object({
    references: z.array(z.object({
      id: z.string(),
      timestamp: z.string(),
      type: z.string(),
    })),
  }),
});

type CompressedState = z.infer<typeof CompressedStateSchema>;

/**
 * Context Proxy - Manages compressed context for agents
 * Reduces token usage by 90% through intelligent state management
 */
export class ContextProxy {
  private redis: Redis;
  private stateStore: Map<string, CompressedState> = new Map();
  private policyCache: Map<string, any> = new Map();
  
  constructor(
    private config: {
      redisUrl: string;
      cacheTTL: number;
      maxContextSize: number;
    }
  ) {
    this.redis = new Redis(config.redisUrl);
  }

  /**
   * Handle incoming message with compressed context
   */
  async handleMessage(
    message: string,
    agentId: string,
    sessionId: string,
    userId: string
  ): Promise<AgentResponse> {
    // 1. Retrieve ONLY relevant state (not full history)
    const state = await this.getCompressedState(agentId, sessionId);
    
    // 2. Compile minimal context
    const context = await this.compileMinimalContext(message, state, agentId);
    
    // 3. Validate context size
    const tokenCount = this.estimateTokens(context);
    if (tokenCount > this.config.maxContextSize) {
      await this.compressContext(context);
    }
    
    // 4. Call agent with compressed context
    const response = await this.callAgent(agentId, context, userId);
    
    // 5. Update state (incremental, not accumulative)
    await this.updateState(agentId, sessionId, response);
    
    // 6. Log for audit
    await this.logExecution(agentId, sessionId, message, response);
    
    return response;
  }

  /**
   * Compile minimal context - only what's needed
   */
  private async compileMinimalContext(
    message: string,
    state: CompressedState,
    agentId: string
  ): Promise<AgentContext> {
    const policy = await this.getCachedPolicy(state.phase, agentId);
    
    return {
      // Cached policy (immutable, cached for 1 hour)
      policy: policy,
      
      // Current state only (no history)
      currentState: state.current,
      
      // Filtered relevant evidence (not all evidence)
      evidence: await this.filterRelevantEvidence(message, state.evidence),
      
      // Current message
      message: message,
      
      // Agent-specific configuration
      agentConfig: await this.getAgentConfig(agentId),
      
      // NOT included: full conversation history
    };
  }

  /**
   * Get cached policy (reduces repeated loading)
   */
  private async getCachedPolicy(phase: string, agentId: string): Promise<any> {
    const cacheKey = `policy:${agentId}:${phase}`;
    
    if (this.policyCache.has(cacheKey)) {
      return this.policyCache.get(cacheKey);
    }
    
    // Check Redis cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      const policy = JSON.parse(cached);
      this.policyCache.set(cacheKey, policy);
      return policy;
    }
    
    // Load from database
    const policy = await this.loadPolicy(agentId, phase);
    
    // Cache for 1 hour
    await this.redis.setex(cacheKey, this.config.cacheTTL, JSON.stringify(policy));
    this.policyCache.set(cacheKey, policy);
    
    return policy;
  }

  /**
   * Filter relevant evidence based on semantic similarity
   */
  private async filterRelevantEvidence(
    message: string,
    evidence: CompressedState['evidence']
  ): Promise<any[]> {
    // Use embedding similarity to find top-k relevant evidence
    const messageEmbedding = await this.getEmbedding(message);
    
    // ⚡ Bolt: Fetched evidence embeddings concurrently using Promise.all to fix N+1 query bottleneck
    const similarities = await Promise.all(
      evidence.references.map(async (ref) => {
        const refEmbedding = await this.getEmbedding(ref.id);
        const similarity = this.cosineSimilarity(messageEmbedding, refEmbedding);
        return { ref, similarity };
      })
    );

    const relevantEvidence = [];
    for (const { ref, similarity } of similarities) {
      if (similarity > 0.7) {
        relevantEvidence.push(ref);
      }
    }
    
    return relevantEvidence.slice(0, 5); // Top 5 only
  }

  /**
   * Spawn subagent for isolated task processing
   */
  async spawnSubagent(
    taskType: string,
    data: any[],
    parentAgentId: string
  ): Promise<SubagentResult> {
    const batchSize = 10;
    const batches = this.chunkArray(data, batchSize);
    
    const results = [];
    
    for (const batch of batches) {
      // Each subagent has CLEAN context (no parent history)
      const subagentId = `${parentAgentId}-sub-${Date.now()}`;
      
      const context = {
        task: taskType,
        data: batch,
        parentAgent: parentAgentId,
        // NO inherited history
      };
      
      const result = await this.callAgent(subagentId, context, 'system');
      
      // Return ONLY compressed result
      results.push({
        valid: result.valid,
        invalid: result.invalid,
        summary: result.summary,
        // NOT included: full processing details
      });
      
      // Subagent is discarded after execution
    }
    
    // Parent agent receives only aggregated results
    return {
      totalProcessed: data.length,
      results: results,
      summary: this.aggregateResults(results),
    };
  }

  /**
   * Update state incrementally (delta only)
   */
  private async updateState(
    agentId: string,
    sessionId: string,
    response: AgentResponse
  ): Promise<void> {
    const state = await this.getCompressedState(agentId, sessionId);
    
    // Update ONLY changed fields
    state.current.pendingApprovals = response.newApprovals || state.current.pendingApprovals;
    state.current.activeIssues = response.newIssues || state.current.activeIssues;
    
    // Keep only last 5 decisions
    if (response.decision) {
      state.current.keyDecisions.push(response.decision);
      if (state.current.keyDecisions.length > 5) {
        state.current.keyDecisions.shift();
      }
    }
    
    // Update metadata
    state.metadata.totalMessages++;
    state.metadata.totalCost += response.cost;
    state.metadata.lastUpdated = new Date().toISOString();
    
    // Save compressed state
    await this.saveCompressedState(agentId, sessionId, state);
  }

  /**
   * Estimate tokens (approximate)
   */
  private estimateTokens(context: any): number {
    const text = JSON.stringify(context);
    return Math.ceil(text.length / 4); // Rough estimate
  }

  /**
   * Get embedding for semantic search
   */
  private async getEmbedding(text: string): Promise<number[]> {
    // Implementation using OpenAI embeddings
    // Cache embeddings in Redis
    const cacheKey = `embedding:${this.hash(text)}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }
    
    const openai = new OpenAI();
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    
    const embedding = response.data[0].embedding;
    
    // Cache for 24 hours
    await this.redis.setex(cacheKey, 86400, JSON.stringify(embedding));
    
    return embedding;
  }

  // Additional helper methods...
}
