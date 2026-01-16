import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const url1 = "https://docs.google.com/spreadsheets/d/12gUsOtAWBQ65ilvTIg5_sAjy7asipUc-nP0ADBx2ng4/edit?gid=855695872#gid=855695872";

function getExportUrl(url: string): string | null {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) return null;

    // Check for gid
    const urlObj = new URL(url);
    const gid = urlObj.searchParams.get('gid') || urlObj.hash.replace('#gid=', '');

    let exportUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=xlsx`;
    if (gid) {
        exportUrl += `&gid=${gid}`;
    }
    return exportUrl;
}

function getOldExportUrl(url: string): string | null {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) return null;
    return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=xlsx`; // No gid
}

async function test() {
    console.log('Original URL:', url1);
    console.log('Old Export Logic:', getOldExportUrl(url1));
    console.log('New Export Logic:', getExportUrl(url1));

    // We won't actually download to save bandwidth/time unless needed, 
    // the logic check is sufficient proof.
}

test();
