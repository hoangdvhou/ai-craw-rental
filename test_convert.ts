import { ExcelProcessor } from './src/processor';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
    const processor = new ExcelProcessor();
    const filePath = path.resolve('DANH SÁCH PHÒNG TRỐNG - NVHOME (3).xlsx');
    console.log(`Testing file: ${filePath}`);
    try {
        const records = await processor.processFile(filePath, 'test-file');
        console.log(`Total records found: ${records.length}`);
        if (records.length > 0) {
            console.log('Sample record:', JSON.stringify(records[0], null, 2));
        } else {
            console.log('No records found!');
        }
    } catch (error) {
        console.error('Error during processing:', error);
    }
}

test();
