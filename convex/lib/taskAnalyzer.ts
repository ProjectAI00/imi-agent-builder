/**
 * Task complexity analysis
 *
 * Simple keyword-based detection for routing between agent and workflow
 */

/**
 * Analyzes if a user request is simple (single-step) or complex (multi-step workflow)
 *
 * Simple: "What's trending on Twitter?" → Agent handles directly (fast)
 * Complex: "Find my latest email", "Get my docs" → Workflow with Grok-4-fast tool calling + GLM-4.5 response
 */
export async function analyzeTaskComplexity(userMessage: string) {
  const lowerMessage = userMessage.toLowerCase();

  // App integration keywords (always route to workflow for fast tool calling)
  const appIntegrationKeywords = [
    'email',
    'gmail',
    'docs',
    'document',
    'google',
    'notion',
    'slack',
    'calendar',
    'drive',
    'sheet',
    'spreadsheet',
  ];

  const isAppIntegration = appIntegrationKeywords.some(keyword => lowerMessage.includes(keyword));

  // Multi-step indicators
  const multiStepKeywords = [
    'then',
    'and then',
    'after that',
    'afterwards',
    'next',
    'also',
    'summarize and',
    'send to',
    'post to',
    'create a',
    'add to',
    'email it',
  ];

  // Check if message contains multi-step indicators
  const hasMultiStep = multiStepKeywords.some(keyword => lowerMessage.includes(keyword));

  // Count action verbs (crude but effective)
  const actionVerbs = ['find', 'get', 'search', 'show', 'list', 'create', 'send', 'post', 'add', 'email', 'summarize', 'check'];
  const actionCount = actionVerbs.filter(verb => lowerMessage.includes(verb)).length;

  // Route to workflow if:
  // 1. App integration task (use Grok-4-fast for tool calling)
  // 2. Multi-step task
  // 3. Multiple actions
  const isComplex = isAppIntegration || hasMultiStep || actionCount > 1;

  const reasoning = isComplex
    ? isAppIntegration
      ? 'App integration task - using workflow (Grok-4-fast tools + GLM-4.5 response)'
      : `Multiple steps detected: ${hasMultiStep ? 'sequential indicators' : 'multiple actions'}`
    : 'Single action task';

  console.log(`[Task Analyzer] ${isComplex ? "COMPLEX" : "SIMPLE"} task: ${reasoning}`);

  return {
    isComplex,
    steps: isComplex ? userMessage.split(/then|and then|after that|afterwards|next/i) : [userMessage],
    reasoning,
  };
}
