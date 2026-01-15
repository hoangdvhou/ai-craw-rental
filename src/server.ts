import express from 'express';
import multer from 'multer';
import { ExcelProcessor } from './processor';
import * as fs from 'fs';
import * as path from 'path';

const app = express();
const upload = multer({ dest: 'uploads/' });
const processor = new ExcelProcessor();

app.use(express.json());
// Serve static frontend
app.use(express.static(path.join(process.cwd(), 'public')));

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
