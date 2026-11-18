-- Link personale (token) per i facilitatori: /?invite=<token>
ALTER TABLE guests ADD COLUMN invite_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_guests_invite ON guests(invite_token);
