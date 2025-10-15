import { dbClient } from './client';

export async function createMetricRecord(data) {
  const query = `
    INSERT INTO conversation_metrics 
      (conversation_id, scrape_started_at, scrape_ended_at, duration_ms, status, error_message)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
  const values = [
    data.conversation_id,
    data.scrape_started_at,
    data.scrape_ended_at,
    data.duration_ms,
    data.status,
    data.error_message,
  ];
  const result = await dbClient.query(query, values);
  return result.rows[0];
}