CREATE TABLE IF NOT EXISTS conversation_metrics (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    scrape_started_at TIMESTAMPTZ NOT NULL,
    scrape_ended_at TIMESTAMPTZ,
    duration_ms INTEGER,
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conversation_metrics_conversation_id ON conversation_metrics(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_metrics_created_at ON conversation_metrics(created_at);