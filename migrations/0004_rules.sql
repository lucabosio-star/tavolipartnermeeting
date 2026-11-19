-- Regola: numero minimo di persone di aziende esterne (non Danfoss) per tavolo
INSERT OR IGNORE INTO settings (key, value) VALUES ('min_external', '2');
-- Regola: nessun esterno da solo (coppie/trio della stessa azienda)
INSERT OR IGNORE INTO settings (key, value) VALUES ('buddies', '1');
