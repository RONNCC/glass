const { BrowserWindow } = require('electron');
const { getSystemPrompt } = require('../../common/prompts/promptBuilder.js');
const { createLLM } = require('../../common/ai/factory');
const sessionRepository = require('../../common/repositories/session');
const summaryRepository = require('./repositories');
const modelStateService = require('../../common/services/modelStateService');
const settingsService = require('../../settings/settingsService');

class SummaryService {
    constructor() {
        // How often (in number of conversation turns) to run an AI analysis.
        // Lower value = more frequent insights.
        this.ANALYSIS_INTERVAL = 5;

        this.previousAnalysisResult = null;
        this.analysisHistory = [];
        this.conversationHistory = [];
        this.currentSessionId = null;
        
        // Callbacks
        this.onAnalysisComplete = null;
        this.onStatusUpdate = null;
    }

    setCallbacks({ onAnalysisComplete, onStatusUpdate }) {
        this.onAnalysisComplete = onAnalysisComplete;
        this.onStatusUpdate = onStatusUpdate;
    }

    setSessionId(sessionId) {
        this.currentSessionId = sessionId;
    }

    sendToRenderer(channel, data) {
        const { windowPool } = require('../../../window/windowManager');
        const listenWindow = windowPool?.get('listen');
        
        if (listenWindow && !listenWindow.isDestroyed()) {
            listenWindow.webContents.send(channel, data);
        }
    }

    addConversationTurn(speaker, text) {
        const conversationText = `${speaker.toLowerCase()}: ${text.trim()}`;
        this.conversationHistory.push(conversationText);
        console.log(`💬 Added conversation text: ${conversationText}`);
        console.log(`📈 Total conversation history: ${this.conversationHistory.length} texts`);

        // Trigger analysis if needed
        this.triggerAnalysisIfNeeded();
    }

    getConversationHistory() {
        return this.conversationHistory;
    }

    resetConversationHistory() {
        this.conversationHistory = [];
        this.previousAnalysisResult = null;
        this.analysisHistory = [];
        console.log('🔄 Conversation history and analysis state reset');
    }

    /**
     * Converts conversation history into text to include in the prompt.
     * @param {Array<string>} conversationTexts - Array of conversation texts ["me: ~~~", "them: ~~~", ...]
     * @param {number} maxTurns - Maximum number of recent turns to include
     * @returns {string} - Formatted conversation string for the prompt
     */
    formatConversationForPrompt(conversationTexts, maxTurns = 30) {
        if (conversationTexts.length === 0) return '';
        return conversationTexts.slice(-maxTurns).join('\n');
    }

    async makeOutlineAndRequests(conversationTexts, maxTurns = 30) {
        console.log(`🔍 makeOutlineAndRequests called - conversationTexts: ${conversationTexts.length}`);

        if (conversationTexts.length === 0) {
            console.log('⚠️ No conversation texts available for analysis');
            return null;
        }

        const recentConversation = this.formatConversationForPrompt(conversationTexts, maxTurns);

        // 이전 분석 결과를 프롬프트에 포함
        let contextualPrompt = '';
        if (this.previousAnalysisResult) {
            contextualPrompt = `
Previous Analysis Context:
- Main Topic: ${this.previousAnalysisResult.topic.header}
- Key Points: ${this.previousAnalysisResult.summary.slice(0, 3).join(', ')}
- Last Actions: ${this.previousAnalysisResult.actions.slice(0, 2).join(', ')}

Please build upon this context while analyzing the new conversation segments.
`;
        }

        // Include the user's selected preset prompt (if any)
        let presetPrompt = '';
        try {
            presetPrompt = await settingsService.getSelectedPresetPrompt();
        } catch (e) {
            console.error('[SummaryService] Failed to fetch preset prompt:', e.message);
        }

        const basePrompt = getSystemPrompt('pickle_glass_analysis', presetPrompt || '', false);
        const systemPrompt = basePrompt.replace('{{CONVERSATION_HISTORY}}', recentConversation);

        try {
            if (this.currentSessionId) {
                await sessionRepository.touch(this.currentSessionId);
            }

            const modelInfo = await modelStateService.getCurrentModelInfo('llm');
            if (!modelInfo || !modelInfo.apiKey) {
                throw new Error('AI model or API key is not configured.');
            }
            console.log(`🤖 Sending analysis request to ${modelInfo.provider} using model ${modelInfo.model}`);
            
            const messages = [
                {
                    role: 'system',
                    content: systemPrompt,
                },
                {
                    role: 'user',
                    content: `${contextualPrompt}

----

Begin with a concise checklist (3-7 bullets) of what you will do; keep items conceptual, not implementation-level.
Review the provided conversation, focusing on questions asked, opportunities for deeper understanding, and suggested follow-ups.
Especially prioritize detecting interview questions and surfacing areas where you might not have an immediate answer.
For each, suggest potential follow-up actions or learning points that can proactively help generate a confident response.
Synthesize your analysis with any previously provided context to ensure a coherent and continuous summary.

Respond with a compact JSON object adhering strictly to this schema:
{
  "summary": string[],                    // up to 5 brief, actionable bullet points
  "topic": { "header": string, "bullets": string[] }, // header string and up to 3 concise bullets
  "actions": string[],                    // up to 5 direct, actionable items or suggestions for quick research, learning, or information gathering; emojis allowed
  "followUps": string[]                   // up to 3 suggested follow-ups, including detected questions or prompts for further inquiry, especially those you may not know how to answer
}

Rules:
- Strings must be brief and direct
- No markdown or extra formatting (no asterisks, dashes, heading symbols, etc.)
- Use [] for empty string arrays and "" for empty header strings when a field cannot be filled
- Synthesize with any existing analysis context if given
- Pay close attention in interview scenarios to any questions, knowledge gaps, or follow-up opportunities where more information may be needed
- Keep the most important or urgent items first within arrays

Output must be a valid JSON object following this schema, with no extra text or formatting. Only return the JSON object.

`,
                },
            ];

            console.log('🤖 Sending analysis request to AI...');

            const llm = createLLM(modelInfo.provider, {
                apiKey: modelInfo.apiKey,
                model: modelInfo.model,
                temperature: 1,
                maxTokens: 512,
                // Prefer real schema when supported (OpenAI, Anthropic, Gemini). Others will ignore.
                responseSchema: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['summary','topic','actions','followUps'],
                  properties: {
                    summary: { type: 'array', maxItems: 5, items: { type: 'string' } },
                    topic: {
                      type: 'object',
                      additionalProperties: false,
                      required: ['header','bullets'],
                      properties: {
                        header: { type: 'string' },
                        bullets: { type: 'array', maxItems: 3, items: { type: 'string' } }
                      }
                    },
                    actions: { type: 'array', maxItems: 5, items: { type: 'string' } },
                    followUps: { type: 'array', maxItems: 3, items: { type: 'string' } }
                  }
                },
                responseSchemaName: 'insights_summary',
                // Fallback hint for providers that only support "json_object"
                responseFormat: { type: 'json_object' },
                usePortkey: modelInfo.provider === 'openai-glass',
                portkeyVirtualKey: modelInfo.provider === 'openai-glass' ? modelInfo.apiKey : undefined,
            });

            const completion = await llm.chat(messages);

            const responseText = completion.content;
            console.log(`✅ Analysis response received: ${responseText}`);

            // Prefer structured JSON parsing; fall back to legacy parser on failure
            let structuredData;
            try {
                const parsed = JSON.parse(responseText);
                structuredData = {
                    summary: Array.isArray(parsed.summary) ? parsed.summary.slice(0, 5) : [],
                    topic: {
                        header: typeof parsed.topic?.header === 'string' ? parsed.topic.header : '',
                        bullets: Array.isArray(parsed.topic?.bullets) ? parsed.topic.bullets.slice(0, 3) : [],
                    },
                    actions: Array.isArray(parsed.actions) ? parsed.actions.slice(0, 5) : [],
                    followUps: Array.isArray(parsed.followUps) ? parsed.followUps.slice(0, 3) : ['✉️ Draft a follow-up email', '✅ Generate action items', '📝 Show summary'],
                };

                // Basic normalization to strip markdown if model ignored instruction
                const stripMd = (s) => typeof s === 'string' ? s.replace(/^[-*\s]+/g, '').replace(/^\*\*|\*\*$/g, '') : s;
                structuredData.summary = structuredData.summary.map(stripMd);
                structuredData.topic.header = stripMd(structuredData.topic.header);
                structuredData.topic.bullets = structuredData.topic.bullets.map(stripMd);
                structuredData.actions = structuredData.actions.map(stripMd);
                structuredData.followUps = structuredData.followUps.map(stripMd);
            } catch (e) {
                console.warn('[SummaryService] JSON parse failed, falling back to legacy parser:', e.message, responseText);
                structuredData = this.parseResponseText(responseText, this.previousAnalysisResult);
            }

            if (this.currentSessionId) {
                try {
                    summaryRepository.saveSummary({
                        sessionId: this.currentSessionId,
                        text: responseText,
                        tldr: structuredData.summary.join('\n'),
                        bullet_json: JSON.stringify(structuredData.topic.bullets),
                        action_json: JSON.stringify(structuredData.actions),
                        model: modelInfo.model
                    });
                } catch (err) {
                    console.error('[DB] Failed to save summary:', err);
                }
            }

            // 분석 결과 저장
            this.previousAnalysisResult = structuredData;
            this.analysisHistory.push({
                timestamp: Date.now(),
                data: structuredData,
                conversationLength: conversationTexts.length,
            });

            if (this.analysisHistory.length > 10) {
                this.analysisHistory.shift();
            }

            return structuredData;
        } catch (error) {
            console.error('❌ Error during analysis generation:', error.message);
            return this.previousAnalysisResult; // 에러 시 이전 결과 반환
        }
    }

    parseResponseText(responseText, previousResult) {
        // 1) Try to salvage JSON first (strip fences, extract JSON block)
        const tryParseJsonFromText = (text) => {
            if (!text || typeof text !== 'string') return null;

            // Remove markdown fences if present
            const fencedMatch = text.match(/```\s*(json)?\s*([\s\S]*?)```/i);
            if (fencedMatch && fencedMatch[2]) {
                try { return JSON.parse(fencedMatch[2].trim()); } catch {}
            }

            // Try to find a JSON object substring
            const firstBrace = text.indexOf('{');
            const lastBrace = text.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                const candidate = text.slice(firstBrace, lastBrace + 1);
                try { return JSON.parse(candidate); } catch {}
            }

            // Try a looser cleanup: remove leading markdown bullets and bolds
            const cleaned = text
                .replace(/\r/g, '')
                .replace(/^[-*•]\s+/gm, '')
                .replace(/\*\*([^*]+)\*\*/g, '$1')
                .trim();
            try { return JSON.parse(cleaned); } catch {}

            return null;
        };

        const normalize = (value) => typeof value === 'string'
            ? value.replace(/^[-*•\s]+/g, '').replace(/\*\*|`/g, '').trim()
            : value;

        const toLimitedArray = (arr, limit) => Array.isArray(arr)
            ? arr.map(normalize).filter(Boolean).slice(0, limit)
            : [];

        // Prefer JSON if we can recover it
        const parsed = tryParseJsonFromText(responseText);
        if (parsed && typeof parsed === 'object') {
            return {
                summary: toLimitedArray(parsed.summary, 5),
                topic: {
                    header: normalize(parsed.topic?.header || ''),
                    bullets: toLimitedArray(parsed.topic?.bullets, 3),
                },
                actions: toLimitedArray(parsed.actions, 5),
                followUps: toLimitedArray(parsed.followUps, 3).length > 0
                    ? toLimitedArray(parsed.followUps, 3)
                    : ['✉️ Draft a follow-up email', '✅ Generate action items', '📝 Show summary'],
            };
        }

        // 2) Lightweight heuristic fallback
        const structuredData = {
            summary: [],
            topic: { header: '', bullets: [] },
            actions: [],
            followUps: ['✉️ Draft a follow-up email', '✅ Generate action items', '📝 Show summary'],
        };

        // Merge prior context where helpful
        if (previousResult) {
            structuredData.topic.header = previousResult.topic.header || '';
            structuredData.summary = Array.isArray(previousResult.summary) ? [...previousResult.summary] : [];
        }

        try {
            const lines = (responseText || '').split('\n').map(l => l.trim()).filter(Boolean);

            // Topic header heuristics
            const topicLine = lines.find(l => /key\s*topic\s*:|^topic\s*:/i.test(l));
            if (topicLine) {
                const m = topicLine.match(/(?:key\s*topic\s*:|^topic\s*:)(.*)$/i);
                if (m && m[1]) structuredData.topic.header = normalize(m[1]);
            }
            if (!structuredData.topic.header && lines.length > 0) {
                structuredData.topic.header = normalize(lines[0]);
            }

            // Collect bullet-like lines
            const bulletLines = lines.filter(l => /^[-*•]\s+/.test(l)).map(l => l.replace(/^[-*•]\s+/, ''));
            // Summary: take first 3–5 short bullets, else fall back to first 2 sentences
            if (structuredData.summary.length === 0 && bulletLines.length > 0) {
                structuredData.summary = bulletLines.slice(0, 5).map(normalize);
            }
            if (structuredData.summary.length === 0) {
                const sentences = (responseText || '')
                    .split(/(?<=[.!?])\s+/)
                    .map(s => normalize(s))
                    .filter(Boolean);
                structuredData.summary = sentences.slice(0, 3);
            }

            // Topic bullets: next bullets (up to 3) that aren't already in summary
            const topicBullets = bulletLines
                .filter(b => !structuredData.summary.includes(normalize(b)))
                .slice(0, 3)
                .map(normalize);
            structuredData.topic.bullets = topicBullets;

            // Actions: any numbered lines or questions → normalize and prefix with ❓ when question
            const numbered = lines.filter(l => /^\d+\./.test(l)).map(l => l.replace(/^\d+\.\s*/, ''));
            for (const item of numbered) {
                const n = normalize(item);
                if (!n) continue;
                structuredData.actions.push(n.includes('?') ? `❓ ${n}` : n);
                if (structuredData.actions.length >= 5) break;
            }
            // Cap actions and ensure defaults exist
            structuredData.actions = structuredData.actions.slice(0, 5);
            const defaults = ['✨ What should I say next?', '💬 Suggest follow-up questions'];
            for (const d of defaults) {
                if (!structuredData.actions.includes(d)) structuredData.actions.push(d);
                if (structuredData.actions.length >= 5) break;
            }
        } catch (error) {
            console.error('❌ Error parsing response text:', error);

            // On any failure, return previous result or minimal shell
            return (
                previousResult || {
                    summary: [],
                    topic: { header: 'Analysis in progress', bullets: [] },
                    actions: ['✨ What should I say next?', '💬 Suggest follow-up questions'],
                    followUps: ['✉️ Draft a follow-up email', '✅ Generate action items', '📝 Show summary'],
                }
            );
        }

        return structuredData;
    }

    /**
     * Triggers analysis when conversation history reaches 5 texts.
     */
    async triggerAnalysisIfNeeded() {
        if (this.conversationHistory.length >= this.ANALYSIS_INTERVAL &&
            this.conversationHistory.length % this.ANALYSIS_INTERVAL === 0) {
            console.log(`Triggering analysis - ${this.conversationHistory.length} conversation texts accumulated`);

            const data = await this.makeOutlineAndRequests(this.conversationHistory);
            if (data) {
                console.log('Sending structured data to renderer');
                this.sendToRenderer('summary-update', data);
                
                // Notify callback
                if (this.onAnalysisComplete) {
                    this.onAnalysisComplete(data);
                }
            } else {
                console.log('No analysis data returned');
            }
        }
    }

    getCurrentAnalysisData() {
        return {
            previousResult: this.previousAnalysisResult,
            history: this.analysisHistory,
            conversationLength: this.conversationHistory.length,
        };
    }
}

module.exports = SummaryService; 