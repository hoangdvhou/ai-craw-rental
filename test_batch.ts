import { ExcelProcessor } from './src/processor';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const files = [
    'DANH SÁCH PHÒNG TRỐNG - NVHOME (3).xlsx',
    'data_1.xlsx',
    'data_2.xlsx',
    'data_3.xlsx',
    'data_5.xlsx',
    'data_6.xlsx'
];

async function runBatch() {
    const processor = new ExcelProcessor();
    console.log('Starting batch test...');
    console.log('----------------------------------------');

    for (const file of files) {
        const filePath = path.resolve(process.cwd(), file);
        if (!fs.existsSync(filePath)) {
            console.log(`❌ FILE NOT FOUND: ${file}`);
            continue;
        }

        console.log(`Processing: ${file}`);
        try {
            const start = Date.now();
            const records = await processor.processFile(filePath, file);
            const duration = Date.now() - start;

            console.log(`✅ Success: Found ${records.length} records in ${duration}ms`);

            // Check for potential issues (empty records, weird values)
            const emptyRooms = records.filter(r => !r.so_phong).length;
            const zeroPrice = records.filter(r => !r.gia_tien).length;

            if (emptyRooms > 0 || zeroPrice > 0) {
                console.log(`   ⚠️  Warnings: ${emptyRooms} missing room numbers, ${zeroPrice} zero prices.`);
            }

            if (records.length > 0) {
                // Print a sample to verify correctness
                const sample = records[0];
                console.log(`   Sample: [${sample.so_phong}] ${sample.dia_chi} - ${sample.gia_tien}`);
            }

        } catch (error) {
            console.log(`❌ Failed: ${error}`);
        }
        console.log('----------------------------------------');
    }
}

runBatch();
