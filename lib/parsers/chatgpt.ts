import * as cheerio from 'cheerio';
import type { Conversation } from '@/types/conversation';

/**
 * Extracts a ChatGPT share page into a structured Conversation.
 * Only the conversation messages are captured.
 * Returns raw HTML in `content` for storage, with parsed messages in `meta`.
 */
export async function parseChatGPT(html: string): Promise<Conversation> {
  const $ = cheerio.load(html);

  // Grab only the conversation messages
  const messages: { role: string; content: string }[] = [];

  $('[data-message-author-role]').each((_, el) => {
    const role = $(el).attr('data-message-author-role') || 'unknown';
    const content = $(el).text().trim();
    if (content) messages.push({ role, content });
  });

  // Fallback: just grab paragraph texts if no role markers
  if (messages.length === 0) {
    $('p').each((_, el) => {
      const text = $(el).text().trim();
      if (text) messages.push({ role: 'user', content: text });
    });
  }

  // Wrap messages in minimal HTML for storage
  const wrappedHtml = `<div class="chatgpt-conversation">${messages
    .map((m) => `<p class="${m.role}">${m.content}</p>`)
    .join('')}</div>`;

  return {
    model: 'ChatGPT',
    scrapedAt: new Date().toISOString(),
    sourceHtmlBytes: html.length,
    content: wrappedHtml, // raw HTML for DB/S3
  };
}
