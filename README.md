# ai-crawl-rental

Service to convert Excel files (listings) to JSON format.

## Features
- **Rule-Based Conversion**: Fast conversion for standard formats.
- **AI-Powered Flexible Conversion**: Automatically handles unknown formats using Google Gemini AI.

## Setup
1. `npm install`
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Add your `GEMINI_API_KEY` to `.env` to enable AI features.
4. `npm run dev`

## Usage
- **POST /convert**: Upload a file (`form-data`).
- **POST /convert-url**: Provide a Google Sheets URL (`json`).
