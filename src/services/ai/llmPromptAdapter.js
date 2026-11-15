/** Compatibility adapter for the existing agent prompts. All inference runs in llm-chat. */
import { llmChat } from './llmGatewayClient';

function textFromContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((part) => typeof part?.text === 'string' ? part.text : '').join('');
}

function normalizeGeminiSchema(schema = {}) {
  const normalized = { ...schema };
  if (typeof normalized.type === 'string') normalized.type = normalized.type.toLowerCase();
  if (normalized.properties) {
    normalized.properties = Object.fromEntries(Object.entries(normalized.properties)
      .map(([key, value]) => [key, normalizeGeminiSchema(value)]));
  }
  if (normalized.items) normalized.items = normalizeGeminiSchema(normalized.items);
  return normalized;
}

function toMessages(systemInstruction, contents) {
  const messages = [];
  if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
  if (typeof contents === 'string') {
    messages.push({ role: 'user', content: contents });
    return messages;
  }
  for (const item of Array.isArray(contents) ? contents : []) {
    const role = item.role === 'model' ? 'assistant' : item.role;
    const content = textFromContent(item.parts || item.content);
    if (['system', 'developer', 'user', 'assistant', 'tool'].includes(role) && content) {
      messages.push({ role, content });
    }
  }
  return messages;
}

function toOpenAiTools(tools) {
  const declarations = (tools || []).flatMap((tool) => tool.functionDeclarations || []);
  return declarations.map((declaration) => ({
    type: 'function',
    function: {
      name: declaration.name,
      description: declaration.description,
      parameters: normalizeGeminiSchema(declaration.parameters || { type: 'object', properties: {} }),
    },
  }));
}

export async function generateContent({ systemInstruction, contents, tools = [], signal } = {}) {
  const response = await llmChat({
    messages: toMessages(systemInstruction, contents),
    tools: toOpenAiTools(tools),
    signal,
  });
  return {
    text: response.text || '',
    functionCalls: response.functionCalls || [],
    provider: response.provider,
    model: response.model,
  };
}
