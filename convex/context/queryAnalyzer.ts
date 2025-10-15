/**
 * Query Analyzer - Determines search strategy
 * 
 * Routes queries to either:
 * - Fast path: Direct vector search for simple queries
 * - Smart path: Query rewriting + parallel search for complex queries
 */

export interface QueryAnalysis {
  isComplex: boolean;
  queryType: 'simple' | 'conversational' | 'followup' | 'recall' | 'multi_concept';
  needsRewrite: boolean;
  reasoning: string;
  confidence: number; // 0-1
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Analyze query to determine search strategy
 */
export function analyzeQuery(
  userMessage: string,
  recentMessages: Message[] = []
): QueryAnalysis {
  const message = userMessage.trim().toLowerCase();
  const wordCount = message.split(/\s+/).length;
  
  // Patterns for different query types
  const followupPatterns = [
    /\b(tell me more|what else|anything else|more about|elaborate|continue|go on)\b/i,
    /\b(other|another|different|additional)\b.*\b(info|information|details|facts)\b/i,
  ];
  
  const conversationalPatterns = [
    /\b(we talked|we discussed|you said|you mentioned|remember when|last time)\b/i,
    /\b(earlier|before|previously|past conversation)\b/i,
  ];
  
  const recallPatterns = [
    /\b(what do you know|tell me about|remind me|recall|remember)\b/i,
    /\b(my|i|me)\b.*\b(preference|favorite|like|about)\b/i,
  ];
  
  const multiConceptPatterns = [
    / and /i,
    / & /i,
    / or /i,
    /,.*,/,  // Multiple commas indicating list
  ];
  
  // Check for follow-up intent
  if (followupPatterns.some(pattern => pattern.test(message))) {
    return {
      isComplex: true,
      queryType: 'followup',
      needsRewrite: true,
      reasoning: 'Follow-up question detected - needs context from previous conversation to fetch NEW information',
      confidence: 0.9
    };
  }
  
  // Check for conversational reference
  if (conversationalPatterns.some(pattern => pattern.test(message))) {
    return {
      isComplex: true,
      queryType: 'conversational',
      needsRewrite: true,
      reasoning: 'References past conversation - needs to understand conversation context',
      confidence: 0.85
    };
  }
  
  // Check for vague recall queries
  const isVagueRecall = recallPatterns.some(pattern => pattern.test(message)) && wordCount <= 8;
  if (isVagueRecall) {
    return {
      isComplex: true,
      queryType: 'recall',
      needsRewrite: true,
      reasoning: 'Vague recall question - needs query expansion for better coverage',
      confidence: 0.8
    };
  }
  
  // Check for multi-concept queries
  if (multiConceptPatterns.some(pattern => pattern.test(message)) && wordCount >= 5) {
    return {
      isComplex: true,
      queryType: 'multi_concept',
      needsRewrite: true,
      reasoning: 'Multiple concepts detected - needs separate searches for each concept',
      confidence: 0.75
    };
  }
  
  // Check conversation context for follow-up potential
  if (recentMessages.length > 0) {
    const lastAssistantMessage = recentMessages
      .slice()
      .reverse()
      .find(m => m.role === 'assistant');
    
    if (lastAssistantMessage) {
      const lastResponseLength = lastAssistantMessage.content.length;
      const isShortQuery = wordCount <= 5;
      
      // Short query after substantial response = likely follow-up
      if (isShortQuery && lastResponseLength > 200) {
        return {
          isComplex: true,
          queryType: 'followup',
          needsRewrite: true,
          reasoning: 'Short query after detailed response - likely implicit follow-up',
          confidence: 0.7
        };
      }
    }
  }
  
  // Long queries might benefit from rewriting
  if (wordCount >= 15) {
    return {
      isComplex: true,
      queryType: 'multi_concept',
      needsRewrite: true,
      reasoning: 'Long query with multiple concepts - rewriting can improve precision',
      confidence: 0.65
    };
  }
  
  // Default to simple/fast path
  return {
    isComplex: false,
    queryType: 'simple',
    needsRewrite: false,
    reasoning: 'Direct factual query - fast semantic search is sufficient',
    confidence: 0.8
  };
}

/**
 * Estimate expected latency for query analysis
 */
export function estimateLatency(analysis: QueryAnalysis): {
  estimatedMs: number;
  breakdown: Record<string, number>;
} {
  if (!analysis.needsRewrite) {
    // Fast path
    return {
      estimatedMs: 150,
      breakdown: {
        vectorSearch: 100,
        formatting: 30,
        storage: 20
      }
    };
  }
  
  // Smart path
  return {
    estimatedMs: 1100,
    breakdown: {
      queryRewriting: 600,
      parallelSearches: 200,
      mergeDedupe: 100,
      formatting: 50,
      storage: 150
    }
  };
}
