# Tavoli Partner Meeting

Web app per assegnare gli ospiti ai tavoli della cena (OGR Torino) tramite QR code:
l'ospite sceglie il proprio nome, accetta l'informativa, risponde a 4 domande scherzose,
la slot machine gira e gli viene rivelato il tavolo e il suo "archetipo".
Le persone con risposte simili finiscono allo stesso tavolo, evitando di concentrare
persone della stessa azienda (per Danfoss: dello stesso dipartimento).

Stack: **Cloudflare Workers + D1 (SQLite) + Hono**, frontend statico senza build.

## Struttura

| Percorso | Cosa contiene |
| --- | --- |
| `src/index.ts` | API (ospiti + admin) |
| `src/quiz.ts` | dimensioni, banca domande (it/fr), archetipi: **modifica qui per cambiare il gioco** |
| `src/assign.ts` | algoritmo di assegnazione e ricalcolo globale |
| `migrations/` | schema D1 |
| `public/` | `index.html` app ospite, `admin.html` pannello admin, `board.html` tabellone |
| `scripts/loadtest.mjs` | test di carico e correttezza (110 persone concorrenti) |

## URL

- `/` app ospite (è l'indirizzo da mettere nel QR code)
- `/admin` pannello admin (password)
- `/board` tabellone da proiettare (richiede login admin)

## Setup su Cloudflare (una volta sola)

1. **Crea il database D1** (dashboard → Storage & Databases → D1 → Create, nome `tavoli-db`),
   oppure da terminale: `npx wrangler d1 create tavoli-db`.
   Copia il `database_id` e incollalo in `wrangler.jsonc` al posto di `REPLACE_WITH_D1_DATABASE_ID`.
2. **Applica lo schema**: `npx wrangler d1 migrations apply tavoli-db --remote`
   (oppure incolla il contenuto di `migrations/0001_init.sql` nella console D1 del dashboard).
3. **Secrets** del Worker (dashboard → Workers → tavoli-partner-meeting → Settings → Variables and Secrets):
   - `ADMIN_PASSWORD` → la password del pannello admin
   - `SESSION_SECRET` → una stringa lunga e casuale (firma dei cookie admin)
   Da terminale: `npx wrangler secret put ADMIN_PASSWORD` e `npx wrangler secret put SESSION_SECRET`.
4. **Deploy**: `npx wrangler deploy`, oppure collega il repo GitHub al Worker
   (Workers & Pages → Create → Import a repository). Impostazioni di build:
   - Build command: *(vuoto)*
   - Deploy command: `npx wrangler d1 migrations apply tavoli-db --remote && npx wrangler deploy`
   - Branch di produzione: `main`

> Nota: il progetto è un **Worker con asset statici**, non un progetto "Pages".
> Se su Cloudflare era stato creato un progetto Pages, crea invece un Worker importando il repo.

## Sviluppo locale

```bash
npm install
cp .dev.vars.example .dev.vars      # imposta password e secret
npm run db:migrate:local
npm run dev                          # http://127.0.0.1:8787
npm run loadtest                     # in un altro terminale: ATTENZIONE, azzera i dati locali
```

## Flusso operativo per l'evento

1. **Setup → Tavoli**: genera i tavoli (numero e posti) e dai a ciascuno un nome/tema (visibile anche all'ospite sotto il numero).
2. **Setup → Invitati**: importa il CSV `nome;cognome;azienda;dipartimento;tavolo`.
   La colonna `tavolo` indica il numero del tavolo di cui la persona è **facilitatore**.
3. Chiedi ai **facilitatori di giocare per primi**: il loro profilo diventa il "seme" del tavolo e attira gli ospiti affini.
4. Stampa il QR code con l'URL dell'app. Gli ospiti giocano, l'admin segue in **Tavoli live** o sul **Tabellone**.
5. Opzionale, prima della cena: **Ricalcola tutte le assegnazioni** per ottimizzare l'affinità (facilitatori fissi).
6. Spunta **Iscrizioni chiuse** quando vuoi congelare le assegnazioni. **Export CSV** per i segnaposto.
7. Dopo l'evento: **Cancella tutti i dati personali**.

## Garanzie di stabilità

- Ogni assegnazione è un singolo `UPDATE` condizionale: scatta solo se la persona è ancora libera **e** il tavolo ha ancora posti.
  SQLite/D1 esegue le scritture in modo serializzato, quindi due richieste contemporanee non possono mai
  superare la capienza né assegnare due tavoli alla stessa persona.
- Il quiz è idempotente: doppio tap, refresh o richieste duplicate restituiscono sempre lo stesso risultato.
- Nessuno può rigiocare; solo l'admin può azzerare una persona (↺) o spostarla.
- Se tutti i tavoli sono pieni la persona vede "rivolgiti allo staff" e appare in alto nel pannello admin come "in attesa".
- Con iscrizioni chiuse nessuna nuova assegnazione viene accettata.

## Il quiz

4 dimensioni, ciascuna con 6 domande; ogni persona riceve 1 domanda casuale per dimensione (4 clic):

| Dimensione | Polo − | Polo + |
| --- | --- | --- |
| energia | Contemplativo | Esploratore |
| gusto | Tradizione | Sperimentazione |
| social | Salotto | Festa |
| metodo | Pianificatore | Improvvisatore |

L'archetipo combina energia×gusto (titolo: Esploratore Fusion, Sherpa del Barolo, Sommelier da Divano, Custode della Nonna)
con social×metodo (epiteto). Tutto in `src/quiz.ts`, bilingue italiano/francese; la lingua è rilevata dal telefono e cambiabile con il toggle IT/FR.
