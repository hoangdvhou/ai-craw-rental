import { GoogleGenerativeAI } from '@google/generative-ai';
import { RoomRecord } from './types';

export class AiColumnMapper {
    private model: any;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
            const genAI = new GoogleGenerativeAI(apiKey);
            const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
            this.model = genAI.getGenerativeModel({ model: modelName });
        }
    }

    async getMapping(rows: any[][]): Promise<Map<number, keyof RoomRecord>> {
        if (!this.model) {
            console.warn('GEMINI_API_KEY not found. Skipping AI mapping.');
            return new Map();
        }

        // Prepare the prompt
        const schemaDescription = `
        - dia_chi: Address of the property (string)
        - so_phong: Room number or name (string)
        - gia_tien: Price (number)
        - trang_thai: Status (TRONG or DA_COC)
        - link_anh: Image URL (string)
        - noi_that: Furniture description (string)
        - dich_vu: Service fees description (string)
        - sdt_quan_ly: Manager phone number (string)
        `;

        const csvData = rows.map(r => r.join('|')).join('\n');

        const prompt = `
        You are an expert data analyst. I have an Excel file subset below. 
        Your task is to identify which column index (0-based) corresponds to my target schema fields.
        
        Target Schema:
        ${schemaDescription}

        Excel Data (Pipe separated):
        ${csvData}

        Instructions:
        1. Analyze the header row (if present) and data rows.
        2. Return a JSON object where keys are the column index (as string) and values are the schema field name.
        3. Only include columns you are confident about.
        4. If a field is derived from multiple columns or unclear, omit it.
        5. Return ONLY the JSON object, no markdown formatting.

        Example Output:
        {
            "0": "dia_chi",
            "3": "so_phong",
            "4": "gia_tien"
        }
        `;

        try {
            let attempts = 0;
            let lastError: any;

            while (attempts < 5) {
                try {
                    return await this.generateWithModel(this.model, prompt);
                } catch (error: any) {
                    lastError = error;
                    const msg = String(error).toLowerCase();

                    if (msg.includes('429') || msg.includes('quota')) {
                        console.log(`[AI Mapper] Rate limited (429). Waiting 20s before retry ${attempts + 1}/5...`);
                        await new Promise(resolve => setTimeout(resolve, 20000));
                        attempts++;
                        continue;
                    }
                    throw error; // Non-429 errors threw immediately
                }
            }
            throw lastError; // If retries exhausted, throw the error to be handled by fallback logic

        } catch (error: any) {
            const msg = String(error).toLowerCase();
            if (msg.includes('404') || msg.includes('not found')) {
                console.log('[AI Mapper] Primary model failed, attempting retries...');

                const fallbackModels = ['gemini-3-flash-preview', 'gemini-2.0-flash', 'gemini-pro-latest'];
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

                for (const modelName of fallbackModels) {
                    try {
                        console.log(`[AI Mapper] Retrying with ${modelName}...`);
                        const fallbackModel = genAI.getGenerativeModel({ model: modelName });
                        return await this.generateWithModel(fallbackModel, prompt);
                    } catch (retryError: any) {
                        console.log(`[AI Mapper] ${modelName} failed.`);
                    }
                }
            }
            console.error('[AI Mapper] Error generating mapping:', error);
            return new Map();
        }
    }

    private async generateWithModel(model: any, prompt: string): Promise<Map<number, keyof RoomRecord>> {
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();

        console.log('[AI Mapper] Raw response:', text);

        const mappingObj = JSON.parse(text);
        const map = new Map<number, keyof RoomRecord>();

        for (const [colIdx, field] of Object.entries(mappingObj)) {
            // AI returns 0-based index, ExcelJS uses 1-based index
            map.set(Number(colIdx) + 1, field as keyof RoomRecord);
        }

        return map;
    }
}
