import { dbClient } from './client';
import { CreateMetricInput } from './types';

export async function createMetricRecord(data: CreateMetricInput) {
  const query = `
    INSERT INTO conversation_metrics
      (conversation_id, scrape_started_at, scrape_ended_at, duration_ms, status, error_message)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;

  const values = [
    data.conversationId,
    data.scrapeStartedAt,
    data.scrapeEndedAt,
    data.durationMs,
    data.status ?? 'pending',
    data.errorMessage ?? null,
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0];
}