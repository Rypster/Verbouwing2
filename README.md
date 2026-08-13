# 🛠️ Verbouw Planner — GitHub, Vercel & Neon Postgres Handleiding

Een interactieve verbouwplanner met plattegrondtekenen, klussenbeheer en automatische ISDE-subsidieberekening.

---

## ⚡ 1. Snel Starten (Vercel & Neon Database Setup)

De applicatie is al **volledig voorbereid op Vercel Serverless & Neon PostgreSQL**.

### Stap 1: Downloaden als ZIP / GitHub
1. Exporteer deze code via het menu (**Export to ZIP** of **Export to GitHub**).
2. Pak het ZIP-bestand uit en push de code naar een repository op **GitHub**.

### Stap 2: Koppel een Neon Database op Vercel
1. Log in op je **Vercel** dashboard.
2. Klik op **"Add New..."** → **"Project"** en importeer je GitHub repository.
3. Ga in het project naar het tabblad **Storage** en klik op **Connect Database** → kies **Neon** (of Vercel Postgres).
4. Vercel maakt nu automatisch de omgevingsvariabele `POSTGRES_URL` of `DATABASE_URL` aan.
5. *(Optioneel)*: Mocht de variabele `DATABASE_URL` heten, vul deze in bij **Environment Variables** op Vercel.

### Stap 3: Automatische Tabel Aangemaakt!
- Je hoeft **geen handmatige SQL-query's** uit te voeren!
- De app bevat een **automatische tabel-initialisator**: zodra de eerste plattegrond of klus wordt opgeslagen, wordt de tabel `projects` automatisch aangemaakt in Neon.
- Mocht je het SQL-schema toch handmatig in de Neon console willen draaien, vind je dit in `schema.sql`.

---

## 📁 2. Exporteren & Importeren van Plattegronden (JSON)

Naast de automatische synchronisatie met de Neon database kun je je plattegronden en klussen ook altijd lokaal bewaren en herstellen:

- **Exporteren**: Klik op de knop **"Exporteer JSON"** in de bovenbalk. Dit downloadt een `.json`-bestand met al je muren, zones, klussen en achtergrondafbeeldingen.
- **Importeren**: Klik op **"Importeer JSON"** om een eerder opgeslagen `.json`-bestand in te laden.

---

## 💻 3. Lokaal Draaien op je Computer

1. Installeer afhankelijkheden:
   ```bash
   npm install
   ```
2. *(Optioneel)* Als je lokaal wilt verbinden met je Neon Database, maak een `.env` bestand aan:
   ```env
   DATABASE_URL=postgres://gebruiker:wachtwoord@ep-xyz.neon.tech/neondb?sslmode=require
   ```
   *(Als je geen `DATABASE_URL` instelt, gebruikt de app lokaal in-memory opslag en browser localStorage).*
3. Start de ontwikkelserver:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in je browser.

