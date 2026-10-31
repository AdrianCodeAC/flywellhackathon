# Flywell

**Asistentul pasagerului, de la rezervare până la primii pași la destinație.**

Aplicația live: <https://flywellhackathon.lovable.app>

Flywell este o aplicație web, optimizată pentru telefon, care îl însoțește pe călător pe toată durata unei călătorii cu avionul. Înainte de zbor, aplicația îl ajută să respecte reglementările oficiale. În timpul zborului, îi oferă sprijin în situații de stres. După aterizare, îl orientează în orașul de destinație, în funcție de preferințele sale.

Aplicația este disponibilă în **română** și **engleză**.

---

## Cuprins

1. [Problema abordată](#problema-abordată)
2. [Funcționalități](#funcționalități)
3. [Arhitectură și tehnologii](#arhitectură-și-tehnologii)
4. [Surse de date](#surse-de-date)
5. [Rulare locală](#rulare-locală)
6. [Variabile de mediu](#variabile-de-mediu)
7. [Structura proiectului](#structura-proiectului)
8. [Testare și calitatea codului](#testare-și-calitatea-codului)
9. [Confidențialitate](#confidențialitate)
10. [Limitări cunoscute](#limitări-cunoscute)
11. [Echipa](#echipa)

---

## Problema abordată

Informațiile de care are nevoie un pasager sunt răspândite în multe locuri:

- regulile privind documentele de călătorie, lichidele și bagajele;
- politicile fiecărei companii aeriene;
- drepturile pasagerilor;
- harta aeroportului;
- transportul de la aeroport și recomandările locale.

Flywell le reunește într-un singur loc, adaptate fiecărei călătorii. Fiecare recomandare care ține de o reglementare are legătură către sursa oficială.

Cerința de la care a pornit proiectul:

> O aplicație ce asistă pasagerul unui avion înainte de zbor, dar și după. Un agent pentru călător înainte de zbor îl ajută și îl sfătuiește cu privire la reglementările oficiale. Un alt agent, după aterizare, îl ajută la prima experiență în locație, în funcție de preferințe. Opțional: oferte de zboruri înainte de cumpărare și planurile aeroporturilor.

## Funcționalități

Meniul principal are trei intrări:

- **Călătoriile mele**
- **Planifică o călătorie**
- **Am deja bilet**

Fiecare călătorie salvată se deschide cu trei taburi: **Înainte de zbor**, **În timpul zborului** și **La sosire**.

### 1. Cont și călătorii salvate (`/trips`, `/account`)

- Te poți autentifica cu Google sau Apple, prin Lovable Cloud Auth.
- Călătoriile salvate se sincronizează între dispozitive.
- Fiecare călătorie reunește checklist-ul, ajutorul din timpul zborului și asistentul de sosire.
- Tabul **În timpul zborului** funcționează complet fără internet: tot ce conține este salvat pe telefon.

### 2. Planificare: oferte de zboruri (`/` și `/flights`)

- Caută zboruri după aeroportul de plecare. Destinația se completează automat și sugerează rute care au prețuri reale.
- Arată un calendar de prețuri pe zile, atât pentru dus, cât și pentru dus-întors.
- Afișează toate zborurile dintr-o perioadă, cu sortare, filtre și grupare.
- Un asistent AI estimează costurile totale ale călătoriei și dă recomandări.
- Un chat permite ajustarea planului de călătorie.
- După alegerea destinației, aplicația recomandă ce loc să alegi în avion, în funcție de preferințe.

### 3. Înainte de zbor: agentul de reglementări (`/preflight`)

**Checklist personalizat.** Se generează din aeroporturi, dată, cetățenie, tipul de bagaj și situații speciale: copii, medicamente, animale de companie. Este împărțit în șase categorii:

| Categorie  | Ce conține                                                                         |
| ---------- | ---------------------------------------------------------------------------------- |
| Documente  | Ce act de identitate e nevoie, ETIAS/EES, ETA pentru Regatul Unit, ESTA pentru SUA |
| Securitate | Regula de 100 ml pentru lichide, obiecte interzise                                 |
| Bagaje     | Ce bagaj e permis, pentru compania aleasă                                          |
| Calendar   | Check-in, ora de sosire la aeroport                                                |
| Vamă       | Ce cantități poți aduce fără taxe când intri în UE                                 |
| Drepturi   | Regulamentul (CE) nr. 261/2004                                                     |

Fiecare punct are legătură către o sursă oficială: MAE, Poliția de Frontieră, Comisia Europeană, EASA, UK Government sau U.S. CBP. Progresul se salvează și rămâne vizibil în timpul derulării. O categorie întreagă se poate bifa dintr-un singur buton.

**Puncte suplimentare generate de AI.** Se adaugă cel mult șase recomandări specifice călătoriei. Fiecare este legată de una dintre sursele oficiale din catalog. Modelul are instrucțiuni explicite să nu speculeze. Recomandările care repetă un punct fix din checklist sunt eliminate.

**Agent conversațional.** Răspunde doar la întrebări despre călătorie și zbor și citează sursele. Dacă serviciul AI nu este disponibil, aplicația răspunde din regulile locale, pe baza cuvintelor cheie.

**Scanarea biletului de îmbarcare.** Citește codul de bare dintr-o fotografie sau dintr-o captură de ecran:

- formate acceptate: PDF417, Aztec, QR, în standardul IATA BCBP;
- completează automat formularul: aeroporturi, dată, companie, număr de zbor;
- decodarea se face integral pe dispozitiv.

**Bagaje pe companie și tip de tarif.** Afișează dimensiunile și greutatea pentru obiectul personal, bagajul de cabină și bagajul de cală, cu legătură către pagina oficială. Companii acoperite:

- Wizz Air, Ryanair, easyJet, TAROM;
- Lufthansa/Austrian și Turkish Airlines, marcate „de verificat”.

**Animale de companie.** Regulile pentru transportul animalelor sunt afișate pe două niveluri, cu legături doar către surse oficiale:

- pe companie aeriană: Wizz Air, Ryanair, easyJet, British Airways, TAROM, Lufthansa, Austrian, Turkish Airlines, KLM, Air France, LOT, ITA, Aegean, Vueling și HiSky;
- pe destinație: în interiorul UE, intrare în UE, Regatul Unit, SUA, Turcia, Emiratele Arabe Unite.

Dacă o companie nu transportă animale, aplicația afișează doar acest lucru.

**Jet lag.** Calculează diferența de fus orar legal, inclusiv ora de vară. Pe baza ei recomandă:

- câte zile de pregătire sunt necesare;
- când să te expui la lumină și când să eviți cofeina;
- cât durează estimativ adaptarea.

**Vremea la sosire.** Prognoza pentru ziua zborului (până la 15 zile înainte) și recomandări de îmbrăcăminte.

**Ghidul aeroportului.** Arată doar pașii de care are nevoie pasagerul, la plecare și la sosire, pe o hartă interactivă desenată din datele OpenStreetMap:

- la plecare: check-in sau predarea bagajului, controlul de securitate, controlul pașapoartelor, poarta de îmbarcare;
- la sosire: controlul pașapoartelor, preluarea bagajelor, vama, ieșirea și transportul.

Harta se salvează pe telefon, ca să poată fi folosită și fără internet.

### 4. În timpul zborului: butonul de ajutor

Butonul **„Ajutor”** este accesibil din orice ecran și funcționează și în modul avion, la fel ca tabul **În timpul zborului**. Conține:

- exerciții de respirație ghidate, cu animație;
- un card cu fraze pe care pasagerul îl poate arăta echipajului;
- butonul **„Cheamă echipajul”**, care face telefonul să vibreze și să sune, ca să atragă atenția;
- un ghid pentru simptome frecvente: atac de panică, greață, presiune în urechi, amețeală, dureri de cap, turbulențe;
- cardul medical personal, care aici se poate doar citi (se modifică din cont).

### 5. După aterizare: agentul de sosire (`/arrival`)

- **Vremea curentă** la destinație și recomandări de îmbrăcăminte.
- **Unde mănânci.** Restaurante și cafenele din centru sau din zona aeroportului, cu filtre și program de funcționare. Pe lângă aeroporturile mici, căutarea se extinde automat dacă găsește prea puține locuri.
- **Cum ajungi în oraș.** Estimări pentru Uber, Bolt și taxi, plus transportul public descris pe Wikivoyage.
- **Ce vizitezi.** Obiective notabile (parcuri, muzee, monumente), cu descrieri de pe Wikipedia în limba aleasă.
- **Întreabă AI-ul.** Un asistent care cunoaște contextul (aeroportul, orașul, preferințele) și propune locuri concrete.
- **Trasee pe hartă.** Fiecare recomandare se poate deschide pe o hartă cu traseul calculat, cu trimitere directă în Google Maps sau Apple Maps. Distanțele și traseele pornesc din locația curentă când ești în apropiere, altfel de la aeroport. Pentru distanțe scurte se folosesc trasee pe jos.

## Arhitectură și tehnologii

| Domeniu                 | Tehnologie                                                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Framework               | [TanStack Start](https://tanstack.com/start): React 19, rute bazate pe fișiere, funcții de server (`createServerFn`) |
| Build                   | Vite                                                                                                                 |
| Interfață               | Tailwind CSS 4, shadcn/ui (Radix UI), Motion, Lucide                                                                 |
| Hărți                   | Leaflet, OpenStreetMap, OSRM                                                                                         |
| Internaționalizare      | react-i18next (`src/locales/en.json`, `src/locales/ro.json`)                                                         |
| Inteligență artificială | Vercel AI SDK, prin Lovable AI Gateway (cu Groq ca alternativă pentru dezvoltarea locală)                            |
| Backend și date         | Lovable Cloud (Supabase), Drizzle ORM                                                                                |
| Coduri de bare          | API-ul nativ `BarcodeDetector`, cu ZXing ca alternativă                                                              |
| Fusuri orare            | `tz-lookup` și `Intl.DateTimeFormat`                                                                                 |
| Testare                 | Vitest                                                                                                               |

Principii de proiectare:

- **Regulile sunt deterministe; AI-ul doar le completează.** Checklist-ul de bază este generat de cod testat (`src/features/preflight/rules.ts`), nu de un model de limbaj. AI-ul doar adaugă puncte și răspunde la întrebări, și poate cita numai surse dintr-un catalog verificat manual.
- **Aplicația funcționează și fără servicii externe.** Dacă AI-ul nu e disponibil, răspunsurile vin din regulile locale. Harta aeroportului, cardul medical și tabul „În timpul zborului” se salvează pe dispozitiv. Datele externe sunt păstrate în cache pe server.
- **Datele sensibile rămân pe dispozitiv.** Biletul de îmbarcare se decodează local. Cardul medical se trimite la server doar pentru a fi salvat în contul utilizatorului.

## Surse de date

| Sursă                                                                                                                     | Utilizare                                                         |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [Travelpayouts](https://www.travelpayouts.com/)                                                                           | Prețuri și calendare de zboruri                                   |
| [OpenStreetMap](https://www.openstreetmap.org/): Overpass, Nominatim, OSM API                                             | Locuri de mâncare, obiective, geocodare, planurile aeroporturilor |
| [OSRM](https://project-osrm.org/)                                                                                         | Calcularea traseelor                                              |
| [Wikipedia](https://www.wikipedia.org/), [Wikidata](https://www.wikidata.org/), [Wikivoyage](https://www.wikivoyage.org/) | Descrieri de obiective, informații despre transport               |
| [Open-Meteo](https://open-meteo.com/)                                                                                     | Vremea curentă și prognoze                                        |
| Surse oficiale (MAE, Poliția de Frontieră, Comisia Europeană, EASA, GOV.UK, U.S. CBP, companiile aeriene)                 | Reglementări și bagaje                                            |

## Rulare locală

### Cerințe

- [Bun](https://bun.sh/) (recomandat; proiectul are `bun.lock`) sau Node.js 20+ cu npm.

### Pași

```bash
git clone https://github.com/AdrianCodeAC/flywellhackathon.git
cd flywellhackathon
bun install
```

Creați fișierul `.env.local` cu variabilele descrise în secțiunea următoare, apoi porniți serverul de dezvoltare:

```bash
bun run dev
```

Pentru dezvoltare locală cu AI, serverul trebuie să aibă acces la variabilele din `.env.local` (de exemplu, `set -a; source .env.local; set +a; bun run dev`).

### Comenzi disponibile

| Comandă           | Descriere                            |
| ----------------- | ------------------------------------ |
| `bun run dev`     | Pornește serverul de dezvoltare      |
| `bun run build`   | Generează build-ul de producție      |
| `bun run preview` | Servește local build-ul de producție |
| `bun run test`    | Rulează testele                      |
| `bun run lint`    | Verifică codul cu ESLint             |
| `bun run format`  | Formatează codul cu Prettier         |

## Variabile de mediu

Variabilele se păstrează în `.env.local`, fișier exclus din Git (regula `*.local` din `.gitignore`). Cheile nu se adaugă niciodată în repository.

| Variabilă                                            | Obligatorie                            | Rol                                                                                |
| ---------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------- |
| `LOVABLE_API_KEY`                                    | În producție                           | Acces la Lovable AI Gateway; setată automat de Lovable Cloud                       |
| `GROQ_API_KEY`                                       | Local, dacă lipsește `LOVABLE_API_KEY` | Alternativă gratuită pentru AI ([console.groq.com](https://console.groq.com/keys)) |
| `TRAVELPAYOUTS_TOKEN`                                | Pentru oferte de zboruri               | Acces la API-ul Travelpayouts                                                      |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`           | Da                                     | Conexiunea la Lovable Cloud, pe server                                             |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Da                                     | Conexiunea la Lovable Cloud, în browser                                            |
| `SUPABASE_SERVICE_ROLE_KEY`                          | Pentru cache-ul partajat               | Acces de server la baza de date                                                    |

Dacă nu este configurat niciun serviciu AI, aplicația funcționează în continuare. Checklist-ul și răspunsurile din regulile locale rămân disponibile.

## Structura proiectului

```text
src/
├── routes/                 Paginile aplicației (rute bazate pe fișiere)
│   ├── index.tsx           Planificarea călătoriei
│   ├── trips.*.tsx         Călătoriile mele și pagina unei călătorii
│   ├── auth.tsx            Autentificare
│   ├── _authenticated/     Pagini care necesită cont (contul utilizatorului)
│   ├── flights.tsx         Toate zborurile dintr-o perioadă
│   ├── preflight.tsx       Înainte de zbor
│   └── arrival.tsx         După aterizare
├── features/
│   ├── trip/               Căutarea zborurilor, calendarul de prețuri, asistentul de planificare
│   ├── trips/              Călătorii salvate, tabul „În timpul zborului”
│   ├── account/            Autentificare, sincronizare, cardul medical
│   ├── preflight/          Reguli, agentul AI, scanarea biletului, bagaje, animale, locuri, jet lag
│   ├── airport/            Ghidul și harta aeroportului
│   ├── inflight/           Butonul de ajutor, respirație, cardul medical
│   └── arrival/            Vreme, mâncare, transport, obiective, asistentul de sosire
├── components/ui/          Componente de interfață (shadcn/ui)
└── locales/                Traducerile în engleză și română
docs/                       Specificațiile funcționalităților
supabase/, drizzle/         Configurarea bazei de date și migrațiile
```

## Testare și calitatea codului

```bash
bun run test
```

Suita de teste (Vitest) acoperă:

- regulile checklist-ului și răspunsurile din regulile locale;
- decodarea biletelor de îmbarcare (IATA BCBP);
- identificarea companiilor aeriene;
- calculul jet lag-ului;
- interpretarea datelor meteo;
- pașii ghidului de aeroport;
- căutarea aeroporturilor, programele de funcționare și legăturile către hărți;
- planificarea zborurilor și modelul călătoriilor salvate;
- regulile pentru animale de companie și recomandările de loc;
- sincronizarea contului și funcționarea fără internet.

Un test verifică în plus că fișierele de traducere în engleză și română au aceleași chei și că textul românesc folosește diacriticele corecte (ș, ț).

## Confidențialitate

- Imaginea biletului de îmbarcare nu este încărcată pe server. Decodarea se face în browser.
- Harta aeroportului și conținutul tabului „În timpul zborului” sunt salvate pe dispozitiv.
- Cardul medical și călătoriile se salvează în contul utilizatorului, numai dacă acesta este autentificat. Există și o copie pe telefon, pentru folosire fără internet.
- Întrebările adresate asistenților AI sunt trimise furnizorului AI doar pentru a genera răspunsul.

## Limitări cunoscute

- Regulile privind bagajele se schimbă des. Datele pentru Lufthansa/Austrian și Turkish Airlines sunt marcate pentru verificare. Pentru toate companiile, sursa de referință rămâne pagina oficială indicată în aplicație.
- Prețurile de zbor provin din cache-ul Travelpayouts. Lipsa unui preț nu înseamnă că nu există zbor pe ruta respectivă.
- Planurile aeroporturilor depind de cât de complete sunt datele în OpenStreetMap pentru fiecare aeroport.
- Informațiile oferite au caracter orientativ și nu înlocuiesc comunicările oficiale ale autorităților sau ale companiilor aeriene.

## Echipa

Proiect realizat pentru un hackathon de:

- **Adrian Cealîcu**: [@AdrianCodeAC](https://github.com/AdrianCodeAC)
- **Tudor Dinu**

Dezvoltat cu [Lovable](https://lovable.dev) și sincronizat cu acest repository. Modificările trimise pe `main` sunt preluate automat în editorul Lovable.
