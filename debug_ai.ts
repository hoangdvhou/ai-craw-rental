import * as dotenv from 'dotenv';
dotenv.config();

// Using node-fetch or native fetch if available (Node 18+)
// Since this project uses ts-node, we assume a recent Node version.

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('❌ No GEMINI_API_KEY found in .env');
        return;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    console.log('Fetching models from:', url.replace(apiKey, 'HIDDEN'));

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
        }
        const data: any = await response.json();

        console.log('--- AVAILABLE MODELS ---');
        if (data.models) {
            const names = data.models
                .filter((m: any) => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
                .map((m: any) => m.name.replace('models/', ''));

            console.log(names.join('\n'));
        } else {
            console.log('No models found in response.');
        }
        console.log('------------------------');

    } catch (error: any) {
        console.error('❌ Error fetching models:', error.message);
    }
}

listModels();
