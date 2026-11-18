-- Genere per il bilanciamento dei tavoli: 'M', 'F' oppure '' (non indicato / altro)
ALTER TABLE guests ADD COLUMN gender TEXT NOT NULL DEFAULT '';

INSERT OR IGNORE INTO settings (key, value) VALUES ('gender_balance', '1');
