/**
 * Structured logging of Anthropic message usage for cost/latency tracking.
 * @param {string} stage - e.g. synthesis | vision | discovery
 * @param {string} model
 * @param {{ usage?: { input_tokens?: number, output_tokens?: number }, model?: string }} msg
 */
export function logClaudeUsage(stage, model, msg) {
  const usage = msg?.usage;
  const payload = {
    event: "claude_usage",
    stage,
    model: model ?? msg?.model ?? null,
    input_tokens: usage?.input_tokens ?? null,
    output_tokens: usage?.output_tokens ?? null,
  };
  console.log(JSON.stringify(payload));
}
