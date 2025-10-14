CREATE TABLE IF NOT EXISTS metrics (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    parse_duration_ms INTEGER NOT NULL,
    upload_duration_ms INTEGER NOT NULL,
    db_insert_duration_ms INTEGER NOT NULL,
    total_duration_ms INTEGER GENERATED ALWAYS AS (parse_duration_ms + upload_duration_ms + db_insert_duration_ms) STORED,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_metrics_conversation_id ON metrics(conversation_id);
CREATE INDEX IF NOT EXISTS idx_metrics_created_at ON metrics(created_at);