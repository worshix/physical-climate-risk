# TobaccoGuard — Tobacco Field Assessment System

A full-stack web application for satellite-based crop health monitoring of tobacco fields. Farmers draw their field boundaries on an interactive map, and the system fetches real weather data plus location-aware NDVI estimates to classify crop health and generate plain-language recommendations.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Folder Structure](#2-folder-structure)
3. [Technology Stack](#3-technology-stack)
4. [Database Schema](#4-database-schema)
5. [Pages & User Interface](#5-pages--user-interface)
6. [Maps & Geospatial System](#6-maps--geospatial-system)
7. [Data Pipeline — Satellite & Weather](#7-data-pipeline--satellite--weather)
8. [Machine Learning Model](#8-machine-learning-model)
9. [Recommendation Engine](#9-recommendation-engine)
10. [API Routes](#10-api-routes)
11. [Authentication](#11-authentication)
12. [End-to-End User Flow](#12-end-to-end-user-flow)
13. [Running the App](#13-running-the-app)

---

## 1. Project Overview

**TobaccoGuard** addresses a practical problem in smallholder tobacco farming: detecting crop stress early without expensive field inspections. The system works by:

1. Letting a farmer register and draw their field boundary on a satellite map.
2. Using the field's geographic coordinates to fetch real weather data (Open-Meteo API) and estimate NDVI (vegetation index) based on the region's land type.
3. Running a trained Logistic Regression classifier to predict the overall crop health status.
4. Applying a rule-based recommendation engine to generate actionable advice.

The design philosophy is **farmer-first**: every output answers the question *"What is happening to my field and what should I do?"* — never exposing raw satellite jargon without explanation.

---

## 2. Folder Structure

```text
tobacco-assessment/
│
├── app/                        # Next.js App Router (pages + API routes)
│   ├── layout.tsx              # Root HTML layout, fonts, metadata
│   ├── page.tsx                # Landing page (public)
│   ├── globals.css             # Global Tailwind styles
│   │
│   ├── auth/
│   │   ├── login/page.tsx      # Login form
│   │   └── signup/page.tsx     # Registration form
│   │
│   ├── dashboard/
│   │   └── page.tsx            # Authenticated home — field cards
│   │
│   ├── field/
│   │   ├── create/page.tsx     # Map-based field creation
│   │   └── [fieldId]/
│   │       ├── page.tsx        # Field overview (map + details)
│   │       └── analyse/
│   │           └── page.tsx    # Analysis results
│   │
│   └── api/                    # Next.js API routes (server-side)
│       ├── auth/
│       │   ├── login/route.ts
│       │   ├── logout/route.ts
│       │   └── signup/route.ts
│       ├── field/
│       │   ├── route.ts        # POST: create field
│       │   └── [fieldId]/route.ts  # DELETE: remove field
│       ├── analyse/route.ts    # POST: run full analysis pipeline
│       └── gee/route.ts        # Placeholder: GEE REST endpoint
│
├── components/                 # Reusable React components
│   ├── DeleteFieldButton.tsx   # Client component for field deletion
│   ├── LogoutButton.tsx        # Client component for logout
│   ├── Map/
│   │   ├── FieldMap.tsx        # Wrapper: dynamic-imports LeafletMap (SSR safe)
│   │   ├── LeafletMap.tsx      # Full Leaflet map with drawing tools
│   │   └── PolygonDrawer.tsx   # (Unused in current build)
│   └── ui/                     # shadcn/ui component library
│       ├── accordion.tsx
│       ├── alert.tsx
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       └── ... (30+ Radix-based primitives)
│
├── lib/                        # Server-side business logic
│   ├── prisma.ts               # Prisma client singleton
│   ├── utils.ts                # Tailwind class merging utility
│   ├── analysis/
│   │   └── recommendations.ts  # Rule-based recommendation engine
│   ├── gee/
│   │   └── satellite.ts        # NDVI estimation + Open-Meteo weather fetch
│   ├── geo/
│   │   └── utils.ts            # Area calculation, centroid, reverse geocoding
│   └── ml/
│       └── inference.ts        # Logistic Regression inference in TypeScript
│
├── models/                     # Python ML training pipeline (offline)
│   ├── data/
│   │   └── raw/
│   │       └── dataset.csv     # 600+ synthetic labelled samples
│   ├── src/
│   │   ├── config.py           # Paths and feature configuration
│   │   ├── feature_engineering.py
│   │   ├── labeling.py         # Rule-based label generation
│   │   ├── train_health_model.py  # Logistic Regression training
│   │   └── export_model.py     # Exports weights to JSON for Next.js
│   ├── models/
│   │   ├── crop_health_model.json   # Exported coefficients (consumed by Next.js)
│   │   ├── crop_health_model.joblib # Binary scikit-learn model (Python use only)
│   │   └── thresholds.json     # NDVI/rainfall/temperature thresholds
│   └── reports/
│       ├── training_summary.md # Classification report
│       └── confusion_matrix.png
│
├── prisma/
│   └── schema.prisma           # Database schema (SQLite)
│
├── hooks/                      # Custom React hooks
├── public/                     # Static assets
├── documents/                  # Project documentation, research paper, diagrams
├── dev.db                      # SQLite database file
├── package.json
├── next.config.ts
├── prisma.config.ts
└── APP_STRUCTURE.md            # Internal design notes
```

---

## 3. Technology Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| UI Components | shadcn/ui (Radix UI primitives) |
| Maps | Leaflet.js + React-Leaflet + Leaflet-Draw |
| Charts | Recharts |
| Database | SQLite via Prisma ORM |
| Authentication | Cookie-based sessions + bcryptjs password hashing |
| Weather API | Open-Meteo (free, no API key) |
| Geocoding | OpenStreetMap Nominatim (free, no API key) |
| ML Training | Python, scikit-learn, pandas, joblib |
| Package Manager | pnpm |

---

## 4. Database Schema

The database is SQLite, managed by Prisma. There are three models:

### `User`

Stores registered farmers.

| Field | Type | Description |
| --- | --- | --- |
| `id` | String (CUID) | Primary key |
| `name` | String | Full name |
| `email` | String (unique) | Login identifier |
| `password` | String | bcrypt hash |
| `createdAt` | DateTime | Registration timestamp |

### `Field`

Stores a farmer's drawn field boundary.

| Field | Type | Description |
| --- | --- | --- |
| `id` | String (CUID) | Primary key |
| `name` | String | User-given field name |
| `cropType` | String | Default: `"Tobacco"` |
| `polygon` | String | GeoJSON stored as a JSON string |
| `area` | Float? | Auto-calculated area in hectares |
| `location` | String? | Reverse-geocoded place name |
| `userId` | String | Foreign key → User |

### `Analysis`

Stores every analysis run for a field.

| Field | Type | Description |
| --- | --- | --- |
| `id` | String (CUID) | Primary key |
| `fieldId` | String | Foreign key → Field |
| `meanNDVI` | Float | Average vegetation index value |
| `ndviTrend` | Enum | `IMPROVING`, `STABLE`, or `DECLINING` |
| `healthStatus` | Enum | `HEALTHY`, `MODERATE_STRESS`, or `HIGH_STRESS` |
| `avgTemperature` | Float | Average temperature over 14 days (°C) |
| `totalRainfall` | Float | Total rainfall over 14 days (mm) |
| `waterStressRisk` | Boolean | `true` if rainfall < 10mm AND NDVI < 0.45 |
| `diseaseRisk` | Boolean | `true` if NDVI variance > 0.05 |
| `rawData` | String | JSON blob (temperature, rain, variance, data source) |
| `recommendations` | String | JSON array of recommendation strings |

**Relationships:** One User → many Fields. One Field → many Analyses (full history is kept).

---

## 5. Pages & User Interface

### Landing Page — `/`

The public-facing home page. Contains:

- A navigation bar with the **TobaccoGuard** logo (emerald leaf icon), Login and Sign Up buttons.
- A hero section with the headline *"Monitor your tobacco field using satellite data"*, a brief description, a primary **Get Started Now** CTA, and a secondary **View Demo** link.
- A three-column benefits section:
  - **Crop health monitoring** — tracks NDVI from satellite imagery
  - **Early stress detection** — identifies water stress or disease before it's visible
  - **Smart recommendations** — tailored advice based on weather and vegetation data
- A footer with copyright.

No map is shown here — the page is intentionally lightweight and farmer-accessible.

---

### Sign Up — `/auth/signup`

A client-side form with fields for:

- **Full Name**
- **Email**
- **Password**
- **Role** — locked to `Farmer` (display only)

On successful registration, the API hashes the password, creates the user in the database, sets a session cookie, and redirects to `/field/create` so the farmer immediately draws their first field.

---

### Login — `/auth/login`

A client-side form with:

- **Email**
- **Password**

On success, the API verifies the bcrypt hash, sets a `userId` cookie (HTTP-only, 7-day expiry), and redirects to `/dashboard`.

---

### Dashboard — `/dashboard`

A server component — authentication is checked server-side using the `userId` cookie. It fetches the user and all their fields from the database, including each field's most recent analysis.

**When no fields exist:** A large empty-state card prompts the farmer with a **Get Started** button linking to field creation.

**When fields exist:** Each field is shown as a card displaying:

- Field name and reverse-geocoded location
- A color-coded health badge:
  - **Healthy 🟢** (`HEALTHY`)
  - **Moderate 🟡** (`MODERATE_STRESS`)
  - **Stressed 🔴** (`HIGH_STRESS`)
  - **No Data** (never analysed)
- Last analysis date
- Two action buttons: **Details** (goes to field overview) and **Analyse** (goes directly to analysis)

The top navigation shows the farmer's name initial as an avatar and a logout button.

---

### Create Field — `/field/create`

The most important screen in the application. A split layout:

**Left sidebar (instructions panel):**

1. **Name your field** — text input for the field name (e.g., "North Plot B")
2. **Zoom to your farm** — latitude/longitude coordinate inputs with a "Go to Location" button that animates the map to those coordinates using Leaflet's `flyTo` method
3. **Draw field boundary** — instructions to use the polygon tool
4. **Metadata** — crop type shown as `Tobacco` (locked)

**Right panel (map):** A full-screen Leaflet map (see [Maps section](#6-maps--geospatial-system)) with polygon drawing enabled.

When the farmer saves, the polygon GeoJSON is POSTed to `/api/field`, which:

- Calculates the polygon area in hectares (Shoelace formula)
- Reverse-geocodes the centroid to get a place name (Nominatim API)
- Stores everything in the database

---

### Field Overview — `/field/[fieldId]`

A server-rendered overview page for a specific field. Contains:

- A read-only map displaying the saved polygon over satellite imagery
- Field name and location description
- Two stat cards: **Calculated Area** (hectares) and **Crop Species**
- A sidebar card showing location, creation date, and a delete button
- A large **Run Analysis** button linking to the analysis page

Access is restricted to the field's owner — a `userId` check is applied in the Prisma query.

---

### Analysis Results — `/field/[fieldId]/analyse`

A client component that fires the analysis API call on mount. While loading it shows a spinner with the message *"Analysing Field..."*.

Once results arrive, the page is divided into four sections:

#### A. Field Summary (top)

A large health status badge (`HEALTHY`, `MODERATE STRESS`, or `HIGH STRESS`) with color coding (green / amber / red), followed by a bold headline and a description referencing satellite and weather data.

#### B. Smart Recommendations

A list of plain-language recommendation cards, each with a green left border and a check icon. Generated by the rule-based engine based on NDVI and weather conditions.

#### C. Risk Assessment & Environment (two columns)

- **Water Stress Risk** — High Risk if rainfall < 10mm AND NDVI < 0.45, otherwise Low Risk
- **Disease Risk** — Moderate Risk if NDVI variance > 0.05, otherwise Minimal Risk
- **Average Temperature** (°C) card
- **Total Rainfall** (mm) card

#### D. Technical Data (collapsible)

Collapsed by default (expandable via an accordion). Shows:

- Mean NDVI value (numeric)
- An area chart (Recharts `AreaChart`) plotting 5 NDVI readings estimated from the mean value: Day -12, Day -9, Day -6, Day -3, and Latest
- The chart uses a green gradient fill and an emerald stroke

---

## 6. Maps & Geospatial System

### Map Library: Leaflet + React-Leaflet

The map is implemented using **Leaflet.js** (open-source), wrapped with **React-Leaflet** for React integration, and extended with **Leaflet-Draw** for the polygon drawing toolbar.

Because Leaflet directly accesses the browser's `window` and `document` objects, it cannot render on the server. The `FieldMap` component solves this with Next.js `dynamic()` import with `ssr: false`, showing a loading spinner until the map hydrates on the client.

### Tile Layers (Satellite Imagery)

Two tile layers are stacked:

1. **ESRI World Imagery** (primary)
   URL: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`
   Provides high-resolution satellite/aerial photography. No API key required.

2. **Stamen Toner Labels** (overlay, 70% opacity)
   URL: `https://stamen-tiles.a.ssl.fastly.net/toner-labels/{z}/{x}/{y}.png`
   Adds place names, roads, and administrative borders on top of the satellite base layer, so farmers can orient themselves.

### Default Map Center

The map defaults to Zimbabwe (`lat: -17.83, lng: 31.05`) — the primary target region for this prototype.

### Polygon Drawing (Leaflet-Draw)

Only the polygon tool is enabled. All other Leaflet-Draw tools (rectangle, circle, circle marker, marker, polyline) are explicitly disabled. Drawn polygons are styled with an emerald green fill (`#10b981`) at 40% opacity.

The `EditControl` component listens for three events:

- `onCreated` — captures the polygon GeoJSON when first drawn
- `onEdited` — updates the polygon when the farmer adjusts vertices
- `onDeleted` — clears the polygon if the farmer removes it

### Coordinate Navigation

On the Create Field page, a farmer can type latitude and longitude values and click **Go to Location**. This calls Leaflet's `flyTo` method with a 1.5-second smooth animation, jumping the map to zoom level 16 over those coordinates.

### GeoJSON Storage

The drawn polygon is captured as a GeoJSON `Feature` object. When saved, it is `JSON.stringify`-ed and stored in the `polygon` column of the `Field` table. When read back, it is parsed with `JSON.parse`. The `GeoJSON` component from React-Leaflet renders it on the field overview page.

### Area Calculation

Area is computed server-side using the **Shoelace formula** (implemented in `lib/geo/utils.ts`):

1. Coordinates are converted from degrees to metres using an equirectangular projection centred on the polygon's centroid latitude.
2. The signed area is computed by the Shoelace formula.
3. The result is converted from square metres to hectares (÷ 10,000).

### Reverse Geocoding

The centroid of the polygon is sent to the **OpenStreetMap Nominatim API**:

```text
https://nominatim.openstreetmap.org/reverse?format=json&lat=...&lon=...&zoom=10
```

The response address is parsed to return the most meaningful location name (city → town → village → county → state → country). This string is stored in the `location` field.

---

## 7. Data Pipeline — Satellite & Weather

The data pipeline lives in `lib/gee/satellite.ts` and runs on every analysis request.

### Step 1 — Extract Polygon Centroid

The polygon's coordinates are extracted from the GeoJSON and a centroid is computed by averaging all vertex coordinates.

### Step 2 — Region Classification

The centroid coordinates are checked against hardcoded bounding boxes for known geographic regions:

**Arid regions** (Sahara, Arabian Desert, Kalahari/Namib, Australian Outback, Gobi, Atacama, Mojave/Sonoran):
NDVI estimated in the range **0.05–0.15**, variance 0.02–0.04, trend negative (−0.01 to −0.03).

**Tropical regions** (Amazon, Congo Basin, Southeast Asian rainforests) and areas within ±23.5° latitude that are not arid:
NDVI estimated in the range **0.6–0.8**, variance 0.02–0.05, trend positive (+0.01 to +0.03).

**Temperate/agricultural regions** (everything else, including Zimbabwe):
NDVI estimated in the range **0.35–0.60**, variance 0.03–0.06, trend slightly random (±0.02).

> **Note:** In a production system this would be replaced by real Sentinel-2 or MODIS satellite imagery from Google Earth Engine or Sentinel Hub. The architecture is designed to swap this out — the `getSatelliteData` function returns the same `SatelliteData` interface regardless of source.

### Step 3 — Real Weather Data (Open-Meteo)

Weather is fetched from the **Open-Meteo** free API — no API key required:

```text
https://api.open-meteo.com/v1/forecast?latitude=...&longitude=...
  &daily=temperature_2m_mean,precipitation_sum
  &past_days=14&forecast_days=0
```

This returns 14 days of daily mean temperature (°C) and precipitation (mm). The app:

- Averages all daily temperatures → `avg_temperature_c`
- Sums all daily precipitation → `total_rainfall_mm`

If the API call fails, it falls back to `{ avgTemp: 25, totalRain: 10 }`.

### Step 4 — Feature Vector

The five features passed to the ML model are:

| Feature | Source |
| --- | --- |
| `mean_ndvi` | Region-based estimation |
| `ndvi_trend` | Region-based estimation (slope) |
| `ndvi_variance` | Region-based estimation |
| `avg_temperature_c` | Open-Meteo API |
| `total_rainfall_mm` | Open-Meteo API |

---

## 8. Machine Learning Model

### Algorithm: Logistic Regression

The crop health classifier uses **multinomial Logistic Regression** (scikit-learn's `LogisticRegression` with `max_iter=1000`).

**Why Logistic Regression?**

- It is fully explainable: the classification decision is a linear combination of inputs plus a bias, one per class.
- The coefficients can be exported as a simple JSON array and the entire inference loop re-implemented in a few lines of TypeScript — no Python runtime needed in production.
- It trains fast and generalises well on small tabular datasets.
- For a prototype with 600 clean synthetic samples across 3 balanced classes, it achieves 97% accuracy (see training report below).

### Training Data

The dataset (`models/data/raw/dataset.csv`) contains approximately 600 synthetic samples, each row being one observation with five features and a label. Labels were assigned using domain knowledge rules:

| Condition | Label |
| --- | --- |
| NDVI > 0.6, positive/stable trend, adequate rainfall | `HEALTHY` |
| NDVI between 0.45 and 0.6, mild decline | `MODERATE_STRESS` |
| NDVI < 0.45, negative trend, high temperature, low rainfall | `HIGH_STRESS` |

Sample rows:

```csv
mean_ndvi, ndvi_trend, ndvi_variance, avg_temperature_c, total_rainfall_mm, crop_health_label
0.72,       0.01,       0.004,         24.5,              128.2,             HEALTHY
0.41,      -0.032,      0.045,         32.1,                8.7,             HIGH_STRESS
0.52,      -0.005,      0.015,         28.3,               35.6,             MODERATE_STRESS
```

### Training Process

Executed by running `models/src/train_health_model.py`:

1. Load `dataset.csv` using pandas.
2. Split into 80% training / 20% test sets (`random_state=42`).
3. Train `LogisticRegression(max_iter=1000, random_state=42)`.
4. Evaluate on the test set — print and save a classification report.
5. Generate and save a confusion matrix heatmap (`reports/confusion_matrix.png`).
6. Save the binary model as `crop_health_model.joblib`.

### Model Export

`models/src/export_model.py` converts the trained scikit-learn model into a JSON file consumable by the Next.js app:

```json
{
  "model_type": "LogisticRegression",
  "features": ["mean_ndvi", "ndvi_trend", "ndvi_variance", "avg_temperature_c", "total_rainfall_mm"],
  "classes": ["HEALTHY", "HIGH_STRESS", "MODERATE_STRESS"],
  "coefficients": [[...], [...], [...]],
  "intercept": [-18.39, 0.97, 17.42]
}
```

Each row in `coefficients` corresponds to one class. Each value is the weight for one feature.

### Training Performance

```text
                  precision    recall  f1-score   support

         HEALTHY       0.97      1.00      0.99        34
     HIGH_STRESS       1.00      0.94      0.97        48
 MODERATE_STRESS       0.93      0.97      0.95        40

        accuracy                           0.97       122
       macro avg       0.97      0.97      0.97       122
    weighted avg       0.97      0.97      0.97       122
```

**97% overall accuracy** on the test set (122 samples).

### Inference in TypeScript

The inference lives in `lib/ml/inference.ts`. Python is never called at runtime. The algorithm is:

```text
For each class j:
  z_j = intercept[j] + sum(coefficients[j][i] * feature[i])

Predict the class with the highest z_j
```

This is the raw linear decision score (before softmax). The class with the maximum score wins. The function returns one of: `"HEALTHY"`, `"MODERATE_STRESS"`, or `"HIGH_STRESS"`.

### Threshold Configuration

A companion file `models/models/thresholds.json` stores human-readable thresholds used by the recommendation engine (not the ML model):

```json
{
  "ndvi":        { "healthy": 0.6, "moderate": 0.45 },
  "rainfall":    { "low": 20 },
  "temperature": { "high": 30 }
}
```

---

## 9. Recommendation Engine

The recommendation engine (`lib/analysis/recommendations.ts`) is entirely rule-based — it runs after the ML prediction and converts the data into farmer-readable advice.

### Rule 1 — Water Stress

```text
IF mean_ndvi < 0.45 AND total_rainfall < 10mm
THEN → "Low vegetation health combined with limited rainfall indicates possible water stress. Irrigation is recommended."
```

### Rule 2 — Declining Crop (Monitor)

```text
IF ndvi_trend = DECLINING AND 0.45 ≤ mean_ndvi ≤ 0.6
THEN → "Crop health is declining. Monitor the field closely for early signs of stress or disease."
```

### Rule 3 — Stable / Healthy

```text
IF mean_ndvi > 0.6 AND ndvi_trend = STABLE or IMPROVING
THEN → "Crop health is stable. No immediate action is required regarding fertilizers or growth regulators."
```

### Rule 4 — Disease Risk

```text
IF ndvi_variance > 0.05 AND avg_temperature > 25°C
THEN → "Irregular vegetation patterns detected. Inspect the field for possible disease or pest activity."
```

### Fallback

If no rule fires: `"Continue routine field observations."`

Multiple rules can fire simultaneously, producing multiple recommendations. Each recommendation explicitly states the data behind it, keeping the system explainable.

---

## 10. API Routes

### `POST /api/auth/signup`

Creates a new user. Hashes password with bcryptjs (10 salt rounds). Sets a `userId` HTTP-only cookie (7-day expiry).

### `POST /api/auth/login`

Validates email and bcrypt password hash. Sets a `userId` cookie. Returns user object.

### `POST /api/auth/logout`

Clears the `userId` cookie.

### `POST /api/field`

Creates a new field for the authenticated user. Calculates area (Shoelace formula) and reverse-geocodes the centroid (Nominatim) before saving to the database.

### `DELETE /api/field/[fieldId]`

Deletes a field and its related analyses. Enforces ownership via the `userId` cookie.

### `POST /api/analyse`

The core analysis route. Steps:

1. Verify authentication via cookie.
2. Fetch the field from the database (ownership enforced).
3. Call `getSatelliteData(polygon)` — fetches real weather from Open-Meteo + estimates NDVI by region.
4. Build a feature vector and call `predictCropHealth(features)` — Logistic Regression inference in TypeScript.
5. Call `getRecommendations(...)` — rule-based engine.
6. Save the full `Analysis` record to the database.
7. Return the result as JSON.

### `POST /api/gee`

Placeholder endpoint for a future Google Earth Engine REST API integration.

---

## 11. Authentication

Authentication is session-based, not JWT-based. After login or signup, the server sets a `userId` cookie:

```text
Set-Cookie: userId=<cuid>; HttpOnly; Path=/; Max-Age=604800
```

- **HttpOnly** — not accessible to JavaScript (protects against XSS)
- **Secure** — only sent over HTTPS in production
- **7-day expiry**

Every protected page (dashboard, field overview, analysis) reads this cookie server-side using Next.js `cookies()`. Every protected API route does the same. If the cookie is absent or the user is not found in the database, the request is redirected to `/auth/login` or returns `401 Unauthorized`.

Passwords are hashed with **bcryptjs** at 10 salt rounds before storage. The raw password is never stored.

---

## 12. End-to-End User Flow

```text
1. Farmer visits landing page (/)
        ↓
2. Clicks "Get Started Now" → /auth/signup
        ↓
3. Enters name, email, password → POST /api/auth/signup
   (password hashed, user created, cookie set)
        ↓
4. Redirected to /field/create
        ↓
5. Types field name + coordinates → map flies to location
   Draws polygon on satellite map with Leaflet-Draw
        ↓
6. Clicks "Save Field" → POST /api/field
   (area calculated, location geocoded, field saved)
        ↓
7. Redirected to /dashboard → sees new field card (No Data status)
        ↓
8. Clicks "Analyse" → /field/[fieldId]/analyse
        ↓
9. POST /api/analyse fires:
   - Fetch weather from Open-Meteo (14-day history)
   - Estimate NDVI from polygon region type
   - Run Logistic Regression classifier
   - Apply recommendation rules
   - Save Analysis to DB
        ↓
10. Results page renders:
    - Health status badge (Healthy / Moderate / High Stress)
    - Smart recommendations (plain language)
    - Risk flags (water stress, disease risk)
    - Environment (temperature, rainfall)
    - Collapsible NDVI chart (Technical Data)
        ↓
11. Farmer returns to dashboard — field card now shows health status
```

---

## 13. Running the App

### Prerequisites

- Node.js 20+
- pnpm
- Python 3.13+ with uv (for ML training only — not required to run the web app)

### Install dependencies

```bash
pnpm install
```

### Set up environment

Create a `.env` file (see `.env` for required variables — primarily the database URL):

```env
DATABASE_URL="file:./dev.db"
```

### Run database migrations

```bash
pnpm dlx prisma migrate dev
```

### Start development server

```bash
pnpm dev
```

Visit `http://localhost:3000`.

### Re-training the ML model (optional)

```bash
cd models
uv sync
cd src
python train_health_model.py
python export_model.py
```

This regenerates `models/models/crop_health_model.json` and `thresholds.json`. The Next.js app imports the JSON file statically — no server restart needed, but a rebuild (`pnpm build`) is required to pick up changes in production.
