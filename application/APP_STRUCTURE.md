
# APP Structure

## Nextjs Main App

1. Overall UI philosophy
2. Page / screen structure
3. Key components per page
4. User flow (end-to-end)
5. Notes on feasibility (map + GEE)

---

### 1. UI philosophy (important for acceptance)

This UI should feel:

* **Simple**
* **Farmer-first**
* **Decision-oriented**
* **Not technical**

Avoid:

* Overloaded dashboards
* Too many charts
* Exposing raw satellite jargon without explanation

Everything should answer one question:

> *“What is happening to my field and what should I do?”*

---

### 2. High-level page structure

Here’s a clean, minimal page list:

#### Public

1. Landing Page
2. Login
3. Sign Up

#### Authenticated (Farmer)

4. Dashboard
5. Field Setup (Map-based)
6. Field Overview
7. Analysis Results

That’s it. No more.

---

### 3. Page-by-page UI structure

#### 1️⃣ Landing Page

**Purpose:** Explain value, not tech.

Sections:

* Short headline
  *“Monitor your tobacco field using satellite data”*
* 3 benefits:

  * Crop health monitoring
  * Early stress detection
  * Smart recommendations
* CTA buttons:

  * Login
  * Sign Up

No maps here. Keep it light.

---

#### 2️⃣ Sign Up / Login

**Sign Up Fields:**

* Name
* Email
* Password
* Role: Farmer (default)

After signup:
👉 Redirect directly to **Create Field**

---

#### 3️⃣ Dashboard (Post-login home)

**Purpose:** Quick status overview

Components:

* Greeting
  *“Welcome, John”*
* Field card (only one field for prototype):

  * Field name
  * Last analysis date
  * Current crop status badge:

    * Healthy 🟢
    * Moderate 🟡
    * Stressed 🔴
* Primary action button:

  * **“Analyse Field”**

If no field exists:
👉 Big CTA: **“Create Your Field”**

---

#### 4️⃣ Field Setup (Map-based)

**This is the most important screen**

Components:

* Interactive map (Mapbox / Leaflet)
* Instructions panel:

  * “Zoom to your farm”
  * “Draw the boundary of your field”
* Polygon drawing tool
* Field metadata:

  * Field name
  * Crop type (default: Tobacco)
* Save Field button

What’s stored:

* Polygon coordinates (GeoJSON)
* Field name
* User ID

This is 100% doable in Next.js.

---

#### 5️⃣ Field Overview

**Purpose:** Context before analysis

Sections:

* Map showing the field polygon
* Field details:

  * Area (auto-calculated)
  * Location (district/province if possible)
* Button:

  * **“Run Analysis”**

This page reassures the farmer:

> “Yes, this is my field.”

---

#### 6️⃣ Analysis Results (Core screen)

Split into **four clear sections**.

---

##### A. Field Summary (Top)

* Field name
* Analysis date
* Overall health status (big visual indicator)
* Confidence level (optional, simple)

---

##### B. Raw Data (Collapsible)

This is important academically.

Show:

* NDVI values (table or simple line chart)
* Temperature
* Rainfall

Make this:

* Expandable
* Optional
* Clearly labeled as “Technical Data”

---

##### C. Predictions

Clear, human-readable outputs:

* Crop health classification
* Stress level
* Risk flags:

  * Water stress risk
  * Disease risk (if included)

Use:

* Icons
* Color-coded labels

No probabilities unless you explain them.

---

##### D. Recommendations (Most important)

Plain language recommendations:

* “Irrigation is recommended within the next 3 days”
* “Monitor for signs of leaf disease”
* “Crop health is stable — no action required”

Each recommendation should link logically to:

* NDVI trend
* Weather conditions

This is where you win marks.

---

### 4. Full user flow (end-to-end)

1. Farmer signs up
2. Redirected to field creation
3. Draws polygon on map
4. Saves field
5. Clicks “Analyse Field”
6. App:

   * Sends polygon to GEE
   * Pulls NDVI + weather
7. Results displayed:

   * Raw data
   * Prediction
   * Recommendation
8. Farmer logs out satisfied

Clean. Logical. Defensible.

---

### 5. Feasibility notes (important reassurance)

#### Polygon-based satellite queries

✅ Fully possible
GEE accepts:

* Polygons
* Bounding boxes
* GeoJSON

#### Weather data per region

✅ Possible via:

* GEE climate datasets
* Simple weather APIs using centroid of polygon

#### Multi-user separation

✅ Easy:

* Each field tied to user ID
* Queries filtered per user



# 1️⃣ Exact analysis outputs (keep this SMALL)

For a prototype, your system should output **no more than 5 things**. Anything more looks fake or over-engineered.

## Core outputs (final)

### 1. Overall Crop Health (ENUM)

Derived from NDVI + trend.

Values:

* `HEALTHY`
* `MODERATE_STRESS`
* `HIGH_STRESS`

This is the **headline result**.

---

### 2. Mean NDVI (number)

* Average NDVI over the selected time range
* Shown as raw data + used internally

Example:

```
Mean NDVI: 0.62
```

---

### 3. NDVI Trend (ENUM)

Computed from slope over time.

Values:

* `IMPROVING`
* `STABLE`
* `DECLINING`

This gives temporal intelligence without ML complexity.

---

### 4. Weather Summary

Simple aggregates over the same period:

* Avg temperature
* Total rainfall

No hourly nonsense.

---

### 5. Risk Flags (boolean set)

Derived, not predicted.

Flags:

* `waterStressRisk`
* `diseaseRisk`

Even if disease is weak — it’s fine for a prototype.

---

# 2️⃣ Recommendation mapping (THIS is critical)

Your recommendations must feel **logical and explainable**.

## Recommendation rules (example)

### Rule 1 – Water Stress

```
IF meanNDVI < 0.45
AND rainfall < threshold
THEN recommend irrigation
```

**Output text:**

> “Low vegetation health combined with limited rainfall indicates possible water stress. Irrigation is recommended.”

---

### Rule 2 – Monitoring Recommendation

```
IF NDVI trend = DECLINING
AND meanNDVI between 0.45 and 0.6
```

**Output text:**

> “Crop health is declining. Monitor the field closely for early signs of stress or disease.”

---

### Rule 3 – Stable Crop

```
IF meanNDVI > 0.6
AND NDVI trend = STABLE or IMPROVING
```

**Output text:**

> “Crop health is stable. No immediate action is required.”

---

### Rule 4 – Disease Risk (soft warning)

```
IF NDVI variance is high
AND temperature is high
```

**Output text:**

> “Irregular vegetation patterns detected. Inspect the field for possible disease or pest activity.”

---

⚠️ Important:

* Always show **why** the recommendation exists
* Never pretend it’s 100% certain

This saves you academically and ethically.

---

# 3️⃣ Next.js component tree (App Router)

This is a **clean, production-shaped tree**, but still prototype-sized.

```
app/
├── layout.tsx
├── page.tsx                (Landing)
├── auth/
│   ├── login/page.tsx
│   └── signup/page.tsx
├── dashboard/
│   └── page.tsx
├── field/
│   ├── create/
│   │   └── page.tsx        (Map + polygon drawing)
│   ├── [fieldId]/
│   │   ├── page.tsx        (Field overview)
│   │   └── analyse/
│   │       └── page.tsx    (Results)
├── api/
│   ├── analyse/route.ts
│   └── gee/route.ts
└── components/
    ├── Map/
    │   ├── FieldMap.tsx
    │   └── PolygonDrawer.tsx
    ├── Dashboard/
    │   └── FieldCard.tsx
    ├── Analysis/
    │   ├── HealthBadge.tsx
    │   ├── NDVIChart.tsx
    │   ├── WeatherSummary.tsx
    │   └── Recommendations.tsx
    └── ui/
        ├── Button.tsx
        ├── Card.tsx
        └── Badge.tsx
```

### Key architectural idea

* **Server Actions / API routes** talk to:

  * GEE
  * Weather source
* UI components are dumb and clean
* Analysis logic lives in:

  ```
  lib/analysis/
  ```

---

# 4️⃣ Prisma schema (SQLite, prototype-safe)

This schema is **simple, correct, and defendable**.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model User {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  password  String
  fields    Field[]
  createdAt DateTime @default(now())
}

model Field {
  id        String   @id @default(cuid())
  name      String
  cropType  String   @default("Tobacco")
  polygon   String   // GeoJSON stored as string
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  analyses  Analysis[]
  createdAt DateTime @default(now())
}

model Analysis {
  id              String   @id @default(cuid())
  fieldId         String
  field           Field    @relation(fields: [fieldId], references: [id])

  meanNDVI        Float
  ndviTrend       NDVITrend
  healthStatus    HealthStatus

  avgTemperature  Float
  totalRainfall   Float

  waterStressRisk Boolean
  diseaseRisk     Boolean

  rawData         String   // JSON string (NDVI series, weather)
  recommendations String   // JSON string or text array

  createdAt       DateTime @default(now())
}

enum NDVITrend {
  IMPROVING
  STABLE
  DECLINING
}

enum HealthStatus {
  HEALTHY
  MODERATE_STRESS
  HIGH_STRESS
}
```

### Why this schema works

* One user → many fields
* One field → many analyses (history!)
* SQLite-friendly
* JSON stored as string (perfectly acceptable for prototype)
* Easy to explain in viva

---
