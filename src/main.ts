import { ExcelProcessor } from './processor';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
    const processor = new ExcelProcessor();
    const inputDir = process.cwd(); // Or arg

    // Test with data_1.xlsx
    const files = fs.readdirSync(inputDir).filter(f => f.startsWith('data_') && f.endsWith('.xlsx'));

    const allRecords = [];

    for (const file of files) {
        console.log(`--- Processing ${file} ---`);
        try {
            const records = await processor.processFile(path.join(inputDir, file), file);
            console.log(`Extracted ${records.length} records from ${file}`);
            allRecords.push(...records);
        } catch (e) {
            console.error(`Error processing ${file}:`, e);
            // Telegram Alert logic here
        }
    }

    // Output JSON
    const outputPath = path.join(inputDir, 'output.json');
    fs.writeFileSync(outputPath, JSON.stringify(allRecords, null, 2));
    console.log(`Written total ${allRecords.length} records to ${outputPath}`);
}

main().catch(console.error);
