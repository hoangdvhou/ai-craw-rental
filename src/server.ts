import * as dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import multer from 'multer';
import { ExcelProcessor } from './processor';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as v4 from 'uuid';

const app = express();
const upload = multer({ dest: 'uploads/' });
const processor = new ExcelProcessor();

app.use(express.json());
// Serve static frontend
app.use(express.static(path.join(process.cwd(), 'public')));

// Helper to convert Google Sheets URL to Export URL
function getExportUrl(url: string): string | null {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) return null;
    return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=xlsx`;
}

app.post('/convert-url', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'No URL provided' });
    }

    const exportUrl = getExportUrl(url);
    if (!exportUrl) {
        return res.status(400).json({ error: 'Invalid Google Sheets URL' });
    }

    const tempFileName = `remote_${Date.now()}.xlsx`;
    const tempFilePath = path.join('uploads', tempFileName);

    try {
        console.log(`Downloading from: ${exportUrl}`);
        const response: any = await axios.get(exportUrl, {
            responseType: 'stream'
        });

        const writer = fs.createWriteStream(tempFilePath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        const records = await processor.processFile(tempFilePath, url);

        // Cleanup
        fs.unlinkSync(tempFilePath);

        return res.json({
            success: true,
            total: records.length,
            records: records
        });
    } catch (error) {
        console.error('URL processing error:', error);
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        return res.status(500).json({
            success: false,
            error: 'Failed to download or process the Google Sheet. Make sure it is public (Anyone with the link can view).'
        });
    }
});

// Main conversion endpoint
app.post('/convert', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const originalName = req.file.originalname;

    console.log(`[UserId: ${req.header('x-user-id') || 'unknown'}] Received file: ${originalName}`);

    try {
        const records = await processor.processFile(filePath, originalName);

        // Cleanup uploaded file
        fs.unlinkSync(filePath);

        return res.json({
            success: true,
            total: records.length,
            records: records
        });
    } catch (error) {
        console.error('Processing error:', error);

        // Try cleanup even on error
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown processing error'
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', version: '1.0.0' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`AI-Crawl Converter Service running on port ${PORT}`);
});
