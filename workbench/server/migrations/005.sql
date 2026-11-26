CREATE TABLE file_payloads (
 file_id TEXT PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE,
 content BYTEA NOT NULL CHECK(octet_length(content) BETWEEN 1 AND 12582912)
);
