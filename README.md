# AI Based Predictive Policing and Crime Heatmap System

## Overview

The **AI Based Predictive Policing and Crime Heatmap System** is a data-driven web application designed to analyze historical crime data and predict future crime trends. The system uses machine learning models to forecast potential crime hotspots and visualize them on an interactive map.

This project helps law enforcement agencies identify high-risk areas, allocate police resources efficiently, and take preventive measures to reduce crime.

---

## Problem Statement

Traditional crime analysis methods rely heavily on manual data interpretation and reactive strategies. Police departments often respond to incidents after they occur rather than proactively preventing them.

This project addresses these issues by:

* Predicting crime trends using machine learning
* Visualizing crime hotspots geographically
* Providing analytical dashboards for decision-making
* Allowing users to report crimes digitally

---

## Objectives

The main objectives of the project are:

* Analyze historical crime data
* Predict future crime patterns using AI models
* Identify crime hotspots using geospatial visualization
* Provide an interactive dashboard for crime analytics
* Enable citizens to report crimes through a web interface

---

## Key Features

### Crime Prediction

Uses machine learning models such as Random Forest and XGBoost to predict different types of crimes.

### Crime Heatmap

Displays crime density and hotspots on an interactive map using geospatial visualization.

### Dashboard Analytics

Provides charts and KPIs showing:

* Crime distribution
* Yearly trends
* Crime categories
* City-wise statistics

### Crime Reporting System

Allows users to report incidents through the web application.

### Authentication System

Secure login and registration using JWT-based authentication.

---

## System Architecture

Frontend (React + Tailwind CSS)

⬇

API Layer (FastAPI Backend)

⬇

Machine Learning Model (Random Forest / XGBoost)

⬇

Database (PostgreSQL / CSV dataset)

---

## Technology Stack

### Frontend

* React.js
* Vite
* Tailwind CSS
* MapLibre GL
* Deck.gl

### Backend

* FastAPI
* Python
* Uvicorn

### Machine Learning

* Scikit-learn
* XGBoost
* Pandas
* NumPy

### Database

* PostgreSQL

### Visualization

* MapLibre GL
* Deck.gl Heatmap Layer
* Chart.js / Recharts

---

## Project Structure

<pre class="overflow-visible! px-0!" data-start="2848" data-end="3215"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute end-1.5 top-1 z-2 md:end-2 md:top-1"></div><div class="pe-11 pt-3"><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼ5 ͼj"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>ai-predictive-policing-system</span><br/><span>│</span><br/><span>├── backend</span><br/><span>│   ├── app</span><br/><span>│   │   ├── routes</span><br/><span>│   │   ├── models</span><br/><span>│   │   ├── schemas</span><br/><span>│   │   └── services</span><br/><span>│   │</span><br/><span>│   ├── main.py</span><br/><span>│   └── requirements.txt</span><br/><span>│</span><br/><span>├── frontend</span><br/><span>│   ├── src</span><br/><span>│   │   ├── components</span><br/><span>│   │   ├── pages</span><br/><span>│   │   └── services</span><br/><span>│   │</span><br/><span>│   ├── package.json</span><br/><span>│   └── vite.config.js</span><br/><span>│</span><br/><span>├── dataset</span><br/><span>├── models</span><br/><span>└── README.md</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

## Installation Guide

### Clone the Repository

<pre class="overflow-visible! px-0!" data-start="3271" data-end="3391"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute end-1.5 top-1 z-2 md:end-2 md:top-1"></div><div class="pe-11 pt-3"><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼ5 ͼj"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>git clone https://github.com/ankuryadavgithub/ai-predictive-policing-system.git</span><br/><span>cd ai-predictive-policing-system</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

## Backend Setup

Create virtual environment

<pre class="overflow-visible! px-0!" data-start="3444" data-end="3471"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute end-1.5 top-1 z-2 md:end-2 md:top-1"></div><div class="pe-11 pt-3"><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼ5 ͼj"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>python -m venv venv</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

Activate environment

Windows

<pre class="overflow-visible! px-0!" data-start="3504" data-end="3533"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute end-1.5 top-1 z-2 md:end-2 md:top-1"></div><div class="pe-11 pt-3"><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼ5 ͼj"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>venv\Scripts\activate</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

Install dependencies

<pre class="overflow-visible! px-0!" data-start="3557" data-end="3596"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute end-1.5 top-1 z-2 md:end-2 md:top-1"></div><div class="pe-11 pt-3"><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼ5 ͼj"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>pip install -r requirements.txt</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

Run the backend server

<pre class="overflow-visible! px-0!" data-start="3622" data-end="3659"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute end-1.5 top-1 z-2 md:end-2 md:top-1"></div><div class="pe-11 pt-3"><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼ5 ͼj"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>uvicorn app.main:app --reload</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

Backend will start at:

<pre class="overflow-visible! px-0!" data-start="3685" data-end="3714"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute end-1.5 top-1 z-2 md:end-2 md:top-1"></div><div class="pe-11 pt-3"><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼ5 ͼj"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>http://127.0.0.1:8000</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

## Frontend Setup

Navigate to frontend

<pre class="overflow-visible! px-0!" data-start="3762" data-end="3781"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute end-1.5 top-1 z-2 md:end-2 md:top-1"></div><div class="pe-11 pt-3"><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼ5 ͼj"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>cd frontend</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

Install dependencies

<pre class="overflow-visible! px-0!" data-start="3805" data-end="3824"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute end-1.5 top-1 z-2 md:end-2 md:top-1"></div><div class="pe-11 pt-3"><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼ5 ͼj"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>npm install</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

Run development server

<pre class="overflow-visible! px-0!" data-start="3850" data-end="3869"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute end-1.5 top-1 z-2 md:end-2 md:top-1"></div><div class="pe-11 pt-3"><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼ5 ͼj"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>npm run dev</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

Frontend will start at:

<pre class="overflow-visible! px-0!" data-start="3896" data-end="3925"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute end-1.5 top-1 z-2 md:end-2 md:top-1"></div><div class="pe-11 pt-3"><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼ5 ͼj"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>http://localhost:5173</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

## Machine Learning Model

The system trains machine learning models using historical crime data.

Models used:

* Random Forest Regressor
* XGBoost Regressor

These models predict:

* Total IPC crimes
* Crime category trends
* Future crime patterns (2026–2030)

The best model is selected based on  **RMSE performance** .

---

## Crime Heatmap Visualization

The application uses:

* MapLibre GL
* Deck.gl Hexagon Layer

to visualize crime intensity on a geographic map.

This helps identify:

* Crime hotspots
* High-risk zones
* Crime clusters

---

## API Endpoints

### Authentication

POST /register

POST /login

### Crime Data

GET /crimes

GET /crime-stats

### Prediction

GET /forecast

### Report Crime

POST /report-crime

## Future Improvements

* Real-time crime prediction
* Integration with police databases
* Mobile application
* AI-based anomaly detection
* Social media crime signal analysis

---

## Conclusion

The AI Based Predictive Policing System demonstrates how machine learning and geospatial analytics can support law enforcement agencies in proactive crime prevention. By analyzing historical crime data and predicting future trends, the system provides actionable insights for improving public safety and resource allocation.

---

## Author

Ankur Yadav

BE Information Technology

Final Year Major Project
