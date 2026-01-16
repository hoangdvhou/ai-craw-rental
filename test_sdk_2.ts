import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
dotenv.config();

async function testSDK() {
    const apiKey = process.env.GEMINI_API_KEY || '';
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    try {
        console.log('Testing gemini-2.0-flash with SDK...');
        const result = await model.generateContent("Hello");
        console.log('Success:', result.response.text());
    } catch (e: any) {
        console.error('Failed:', e.message);
    }
}

testSDK();
