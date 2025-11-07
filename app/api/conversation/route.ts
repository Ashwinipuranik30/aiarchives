import { NextRequest, NextResponse } from 'next/server';
import { parseHtmlToConversation } from '@/lib/parsers';
import { dbClient } from '@/lib/db/client';
import { s3Client } from '@/lib/storage/s3';
import { CreateConversationInput } from '@/lib/db/types';
import { performance } from 'perf_hooks';
import { createMetricRecord } from '@/lib/db/metrics';
import { createConversationRecord, getAllConversationRecords } from '@/lib/db/conversations';
import { randomUUID } from 'crypto';
import { loadConfig } from '@/lib/config';

let isInitialized = false;

/**
 * Initialize services if not already initialized
 */
async function ensureInitialized() {
  if (!isInitialized) {
    try {
      const config = loadConfig();
      await dbClient.initialize(config.database);
      s3Client.initialize(config.s3);
      isInitialized = true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('already initialized')) {
        isInitialized = true;
      } else {
        throw error;
      }
    }
  }
}

const ALLOWED_ORIGIN = '*';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

/**
 * POST /api/conversation
 * Handles storing a new conversation.
 * Accepts both scraped HTML uploads and direct MCP structured messages.
 */
export async function POST(req: NextRequest) {
  const scrapeStartedAt = new Date();
  const perfStart = performance.now();

  try {
    await ensureInitialized();

    const formData = await req.formData();
    const file = formData.get('htmlDoc');
    const model = formData.get('model')?.toString() ?? 'ChatGPT';
    const isMCP = formData.get('isMCP') === 'true';

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: '`htmlDoc` must be a file field' }, { status: 400 });
    }

    const html = await file.text();

    // -------- PHASE 1: Parse or Use Direct HTML --------
    let conversation;
    if (isMCP) {
      console.log('⚡ MCP mode detected — skipping HTML parsing.');
      conversation = {
        model,
        scrapedAt: new Date(),
        sourceHtmlBytes: new TextEncoder().encode(html).length,
        content: html,
      };
    } else {
      conversation = await parseHtmlToConversation(html, model);
    }

    // -------- PHASE 2: Upload to S3 --------
    const conversationId = randomUUID();
    const contentKey = await s3Client.storeConversation(conversationId, conversation.content);

    // -------- PHASE 3: Insert into DB --------
    const scrapedAt = conversation.scrapedAt instanceof Date
  ? conversation.scrapedAt
  : new Date(conversation.scrapedAt);

    const dbInput: CreateConversationInput = {
      model: conversation.model,
      scrapedAt,
      sourceHtmlBytes: conversation.sourceHtmlBytes,
      views: 0,
      contentKey,
    };


    const record = await createConversationRecord(dbInput);

    const scrapeEndedAt = new Date();
    const totalDurationMs = Math.round(performance.now() - perfStart);

    // -------- PHASE 4: Record metrics --------
    await createMetricRecord({
      conversationId: record.id,
      scrapeStartedAt,
      scrapeEndedAt,
      durationMs: totalDurationMs,
    });

    console.log(`✅ Conversation ${record.id} processed successfully in ${totalDurationMs} ms`);

    const permalink = `${process.env.NEXT_PUBLIC_BASE_URL}/conversation/${record.id}`;

    return NextResponse.json(
      { url: permalink },
      {
        status: 201,
        headers: { 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
      }
    );
  } catch (err) {
    console.error('❌ Error processing conversation:', err);
    return NextResponse.json({ error: 'Internal error, see logs' }, { status: 500 });
  }
}

/**
 * GET /api/conversation
 * Retrieves a list of all conversations with pagination.
 */
export async function GET(req: NextRequest) {
  try {
    await ensureInitialized();

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json({ error: 'Invalid limit parameter. Must be between 1 and 100.' }, { status: 400 });
    }
    if (isNaN(offset) || offset < 0) {
      return NextResponse.json({ error: 'Invalid offset parameter. Must be non-negative.' }, { status: 400 });
    }

    const conversations = await getAllConversationRecords(limit, offset);
    return NextResponse.json(
      { conversations },
      { status: 200, headers: { 'Access-Control-Allow-Origin': ALLOWED_ORIGIN } }
    );
  } catch (err) {
    console.error('Error retrieving conversations:', err);
    return NextResponse.json({ error: 'Internal error, see logs' }, { status: 500 });
  }
}