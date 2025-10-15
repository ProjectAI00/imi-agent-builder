/**
 * Parallel Search - Execute multiple vector searches and merge results
 * 
 * Handles:
 * - Parallel execution of multiple search queries
 * - Result merging and deduplication
 * - Scoring and ranking
 * - Diversity optimization
 */

import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";

export interface SearchResult {
  memoryId: string;
  fact: string;
  score: number;
  source: string; // which query variation found it
  threadId?: string;
  timestamp?: number;
}

export interface MergedResults {
  results: SearchResult[];
  totalSearched: number;
  duplicatesRemoved: number;
  searchLatencyMs: number;
}

/**
 * Execute multiple searches in parallel
 */
export async function parallelSearch(
  ctx: ActionCtx,
  userId: string,
  queries: string[],
  options: {
    threshold?: number;
    maxResults?: number;
    boostDiversity?: boolean;
    memoryPoolSize?: number;
  } = {}
): Promise<MergedResults> {
  const {
    threshold = 0.2,
    maxResults = 10,
    boostDiversity = true,
    memoryPoolSize = 50,
  } = options;
  
  const startTime = Date.now();
  
  console.log(`[ParallelSearch] Executing ${queries.length} searches for user ${userId}`);
  
  const recentMemories = await ctx.runQuery(
    internal.tools.searchMemoryHelpers.fetchRecentMemories,
    {
      userId,
      limit: memoryPoolSize,
    }
  );

  if (recentMemories.length === 0) {
    console.log(`[ParallelSearch] No memories found for user`);
    return {
      results: [],
      totalSearched: 0,
      duplicatesRemoved: 0,
      searchLatencyMs: Date.now() - startTime,
    };
  }

  const candidateResults: SearchResult[] = [];
  const totalMemories = recentMemories.length;

  queries.forEach((query, queryIndex) => {
    const queryTokens = tokenize(query);
    if (queryTokens.size === 0) {
      return;
    }

    recentMemories.forEach((memory: any, memoryIndex: number) => {
      if (!memory?.facts || !Array.isArray(memory.facts)) {
        return;
      }

      memory.facts.forEach((fact: string) => {
        const factTokens = tokenize(fact);
        if (factTokens.size === 0) {
          return;
        }

        const baseScore = scoreFactAgainstQuery(
          queryTokens,
          factTokens,
          memoryIndex,
          totalMemories
        );

        if (baseScore <= 0) {
          return;
        }

        const adjustedScore = Math.max(0, baseScore - queryIndex * 0.02);
        if (adjustedScore <= 0) {
          return;
        }

        candidateResults.push({
          memoryId: memory._id,
          fact,
          score: adjustedScore,
          source: `query_${queryIndex}: ${truncate(query, 30)}`,
          threadId: memory.threadId,
          timestamp: memory.timestamp ?? memory._creationTime,
        });
      });
    });
  });

  console.log(
    `[ParallelSearch] Scored ${candidateResults.length} candidate results from ${recentMemories.length} memories`
  );
  
  let flatResults = candidateResults;
  console.log(`[ParallelSearch] Got ${flatResults.length} total results before deduping`);

  if (flatResults.length === 0) {
    flatResults = buildFallbackResults(recentMemories, maxResults);
  }
  
  if (flatResults.length === 0) {
    return {
      results: [],
      totalSearched: 0,
      duplicatesRemoved: 0,
      searchLatencyMs: Date.now() - startTime,
    };
  }
  
  // Merge and deduplicate
  let merged = mergeAndDedupe(flatResults, {
    maxResults,
    boostDiversity,
    threshold,
  });

  if (merged.length === 0) {
    const fallbackPool = buildFallbackResults(recentMemories, maxResults * 2);
    if (fallbackPool.length > 0) {
      merged = mergeAndDedupe(fallbackPool, {
        maxResults,
        boostDiversity,
        threshold,
      });
    }
  }
  
  const searchLatencyMs = Date.now() - startTime;
  
  console.log(`[ParallelSearch] Returned ${merged.length} unique results in ${searchLatencyMs}ms`);
  
  return {
    results: merged,
    totalSearched: flatResults.length,
    duplicatesRemoved: flatResults.length - merged.length,
    searchLatencyMs,
  };
}

/**
 * Merge and deduplicate search results
 */
function mergeAndDedupe(
  results: SearchResult[],
  options: {
    maxResults: number;
    boostDiversity: boolean;
    threshold: number;
  }
): SearchResult[] {
  const { maxResults, boostDiversity, threshold } = options;
  
  if (results.length === 0) return [];
  
  // Step 1: Deduplicate by exact fact match
  const seenFacts = new Set<string>();
  const uniqueByFact: SearchResult[] = [];
  
  for (const result of results) {
    const normalizedFact = result.fact.toLowerCase().trim();
    if (!seenFacts.has(normalizedFact)) {
      seenFacts.add(normalizedFact);
      uniqueByFact.push(result);
    } else {
      // Keep the one with higher score
      const existingIndex = uniqueByFact.findIndex(
        r => r.fact.toLowerCase().trim() === normalizedFact
      );
      if (existingIndex >= 0 && result.score > uniqueByFact[existingIndex].score) {
        uniqueByFact[existingIndex] = result;
      }
    }
  }
  
  // Step 2: Deduplicate by semantic similarity (if very similar)
  const deduped = semanticDedupe(uniqueByFact, 0.95); // 95% similarity threshold
  
  // Step 3: Apply threshold filter
  const filtered = deduped.filter(r => r.score >= threshold);
  
  // Step 4: Sort by score
  filtered.sort((a, b) => b.score - a.score);
  
  // Step 5: Apply diversity boosting if enabled
  const final = boostDiversity
    ? applyDiversityBoost(filtered, maxResults)
    : filtered.slice(0, maxResults);
  
  return final;
}

/**
 * Remove semantically similar results (keeps highest scored)
 */
function semanticDedupe(
  results: SearchResult[],
  similarityThreshold: number
): SearchResult[] {
  if (results.length <= 1) return results;
  
  const kept: SearchResult[] = [results[0]];
  
  for (let i = 1; i < results.length; i++) {
    const current = results[i];
    let isDuplicate = false;
    
    for (const existing of kept) {
      const similarity = calculateSimilarity(current.fact, existing.fact);
      if (similarity >= similarityThreshold) {
        isDuplicate = true;
        // Keep the higher scored one
        if (current.score > existing.score) {
          const index = kept.indexOf(existing);
          kept[index] = current;
        }
        break;
      }
    }
    
    if (!isDuplicate) {
      kept.push(current);
    }
  }
  
  return kept;
}

/**
 * Simple string similarity (Jaccard coefficient)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/));
  const words2 = new Set(str2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Boost diversity by preferring results from different memories/threads
 */
function applyDiversityBoost(
  results: SearchResult[],
  maxResults: number
): SearchResult[] {
  const selected: SearchResult[] = [];
  const usedMemoryIds = new Set<string>();
  const usedThreadIds = new Set<string>();
  
  // First pass: Take top results with diversity preference
  for (const result of results) {
    if (selected.length >= maxResults) break;
    
    // Prefer results from new memories/threads
    const isNewMemory = !usedMemoryIds.has(result.memoryId);
    const isNewThread = result.threadId && !usedThreadIds.has(result.threadId);
    
    if (isNewMemory || isNewThread || selected.length < maxResults / 2) {
      selected.push(result);
      usedMemoryIds.add(result.memoryId);
      if (result.threadId) usedThreadIds.add(result.threadId);
    }
  }
  
  // Second pass: Fill remaining slots with highest scored (ignore diversity)
  if (selected.length < maxResults) {
    for (const result of results) {
      if (selected.length >= maxResults) break;
      if (!selected.includes(result)) {
        selected.push(result);
      }
    }
  }
  
  return selected;
}

function truncate(value: string, length: number): string {
  return value.length <= length ? value : `${value.substring(0, Math.max(0, length - 3))}...`;
}

function scoreFactAgainstQuery(
  queryTokens: Set<string>,
  factTokens: Set<string>,
  recencyRank: number,
  totalMemories: number
): number {
  if (queryTokens.size === 0 || factTokens.size === 0) {
    return 0;
  }

  const lexical = jaccardFromSets(queryTokens, factTokens);
  if (lexical === 0) {
    return 0;
  }

  const keywordBoost = hasKeywordOverlap(queryTokens, factTokens) ? 0.05 : 0;
  const recency = totalMemories <= 1 ? 1 : 1 - recencyRank / totalMemories;
  const score = Math.min(1, lexical * 0.75 + recency * 0.25 + keywordBoost);
  return score;
}

function tokenize(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 1)
  );
}

function jaccardFromSets(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }

  let intersection = 0;
  const union = new Set<string>(a);

  b.forEach((token) => {
    if (a.has(token)) {
      intersection += 1;
    }
    union.add(token);
  });

  return intersection / union.size;
}

function hasKeywordOverlap(a: Set<string>, b: Set<string>): boolean {
  for (const token of a) {
    if (token.length <= 3) continue;
    if (b.has(token)) {
      return true;
    }
  }
  return false;
}

function buildFallbackResults(memories: any[], maxResults: number): SearchResult[] {
  const fallback: SearchResult[] = [];

  memories.forEach((memory: any, index: number) => {
    if (!memory?.facts || !Array.isArray(memory.facts)) {
      return;
    }

    const recency = memories.length <= 1 ? 1 : 1 - index / memories.length;
    const baseScore = 0.25 + recency * 0.15;

    memory.facts.forEach((fact: string) => {
      if (fallback.length >= maxResults) {
        return;
      }

      fallback.push({
        memoryId: memory._id,
        fact,
        score: Math.min(1, baseScore),
        source: "recent_memory",
        threadId: memory.threadId,
        timestamp: memory.timestamp ?? memory._creationTime,
      });
    });
  });

  return fallback.slice(0, maxResults);
}

/**
 * Format search results for context injection
 */
export function formatResultsForContext(results: SearchResult[]): string {
  if (results.length === 0) return '';
  
  return results
    .map((r, i) => `${i + 1}. ${r.fact}`)
    .join('\n');
}
