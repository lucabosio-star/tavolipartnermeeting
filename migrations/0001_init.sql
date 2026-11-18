-- Impostazioni chiave/valore
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('locked', '0'),            -- 1 = iscrizioni chiuse, nessuna nuova assegnazione
  ('reveal', '1'),            -- 1 = mostra subito il tavolo; 0 = mostra solo archetipo, tavolo nascosto
  ('max_same_group', '2'),    -- soglia oltre la quale la stessa azienda/dipartimento viene penalizzata
  ('default_capacity', '10');

-- Tavoli: id = numero stampato sul tavolo
CREATE TABLE IF NOT EXISTS tables (
  id        INTEGER PRIMARY KEY,
  name      TEXT NOT NULL DEFAULT '',
  capacity  INTEGER NOT NULL DEFAULT 10,
  -- vettore del facilitatore (seed dell'archetipo del tavolo), JSON array o NULL
  seed_vector TEXT
);

-- Invitati (lista caricata dall'admin)
CREATE TABLE IF NOT EXISTS guests (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  company       TEXT NOT NULL DEFAULT '',
  department    TEXT NOT NULL DEFAULT '',
  -- gruppo usato per la regola "meno persone della stessa azienda":
  -- per Danfoss = dipartimento, per gli altri = azienda (calcolato al caricamento)
  group_key     TEXT NOT NULL DEFAULT '',
  -- se valorizzato, l'invitato è facilitatore di quel tavolo
  facilitator_table_id INTEGER REFERENCES tables(id) ON DELETE SET NULL,
  consent_at    TEXT,
  device_token  TEXT,
  locale        TEXT,
  quiz_question_ids TEXT,     -- JSON: domande estratte per questa persona
  answers       TEXT,         -- JSON: risposte date
  vector        TEXT,         -- JSON: punteggio per dimensione
  archetype     TEXT,
  table_id      INTEGER REFERENCES tables(id) ON DELETE SET NULL,
  assigned_at   TEXT,
  assigned_by   TEXT,         -- 'quiz' | 'admin' | 'facilitator'
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_guests_table ON guests(table_id);
CREATE INDEX IF NOT EXISTS idx_guests_name ON guests(last_name, first_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_guests_token ON guests(device_token);

-- Log eventi per diagnostica
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  kind TEXT NOT NULL,
  guest_id INTEGER,
  detail TEXT
);
