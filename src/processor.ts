import ExcelJS from 'exceljs';
import { RoomRecord } from './types';
import { v4 as uuidv4 } from 'uuid';
import { AiColumnMapper } from './ai_mapper';

export class ExcelProcessor {
    private currentAddress: string = '';
    private currentDistrict: string = '';

    // Fuzzy mapping for columns
    private readonly columnMap: Record<string, keyof RoomRecord | 'ignore'> = {
        'phòng': 'so_phong',
        'số phòng': 'so_phong',
        'mã phòng': 'so_phong',
        // 'mã': 'so_phong', // Removed: too generic, matches "máy", "camera"...
        'giá': 'gia_tien',
        'giá tiền': 'gia_tien',
        'đơn giá': 'gia_tien',
        'tiền thuê': 'gia_tien',
        'trạng thái': 'trang_thai',
        'tình trạng': 'trang_thai',
        'loại phòng': 'loai_phong',
        'ảnh': 'link_anh',
        'link ảnh': 'link_anh',
        'hình ảnh': 'link_anh',
        'nội thất': 'noi_that',
        'đồ đạc': 'noi_that',
        'dịch vụ': 'dich_vu',
        'tiện ích': 'dich_vu',
        'sdt': 'sdt_quan_ly',
        'liên hệ': 'sdt_quan_ly',
        'quản lý': 'sdt_quan_ly',
        'chủ nhà': 'sdt_quan_ly',
        'ghi chú': 'ghi_chu',
        'note': 'ghi_chu',
        'địa chỉ': 'dia_chi',
        'địa chỉ nhà': 'dia_chi',
        'stt': 'ignore',
        'số tt': 'ignore'
    };

    private aiMapper = new AiColumnMapper();

    /**
     * Entry point to process a single file.
     */
    async processFile(filePath: string, fileSourceId: string): Promise<RoomRecord[]> {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);

        const records: RoomRecord[] = [];

        // Iterate sheets sequentially to allow await
        for (const sheet of workbook.worksheets) {
            if (sheet.state !== 'visible') continue;

            console.log(`Processing sheet: ${sheet.name}`);
            this.currentAddress = '';

            // 1. Determine Header Map
            let headerMap = this.detectHeaderMapByRules(sheet);

            if (headerMap.size === 0) {
                console.log('[Info] No standard headers found. Attempting AI mapping...');
                headerMap = await this.detectHeaderMapByAI(sheet);
            }

            if (headerMap.size === 0) {
                console.log('[Warn] Could not determine headers for sheet:', sheet.name);
                continue;
            }

            console.log(`[DEBUG] Final Header Map for ${sheet.name}:`, Object.fromEntries(headerMap));

            // 2. Process Rows
            sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
                if (row.hidden) return;

                // Skip rows before the header (heuristic: if row number is <= header row?)
                // Actually the map uses column indices, so any row *could* be data.
                // But usually data is below header.
                // For simplicity, we just try to parse every row. if it looks like a header, ignore it.

                if (this.isHeaderRow(row)) return;

                // Check Section Header
                if (this.isSectionHeader(row)) {
                    this.currentAddress = this.extractAddress(row);
                    console.log(`[DEBUG] Found Address: ${this.currentAddress}`);
                    return;
                }

                // Data Row
                const hasMappedData = this.checkRowHasData(row, headerMap);
                if (hasMappedData) {
                    const record = this.parseRecord(row, headerMap, fileSourceId);
                    if (record) {
                        records.push(record);
                    }
                }
            });
        }

        return records;
    }

    private detectHeaderMapByRules(sheet: ExcelJS.Worksheet): Map<number, keyof RoomRecord> {
        let bestMap = new Map<number, keyof RoomRecord>();

        sheet.eachRow((row, _rowNumber) => {
            if (bestMap.size > 0) return; // Found one already
            if (this.isHeaderRow(row)) {
                const map = this.mapHeaders(row);

                // Validation: correct map should not have too many duplicates
                // e.g. if 10 columns map to 'so_phong', it's likely a calendar or schedule, not a header
                const counts = new Map<string, number>();
                map.forEach((key) => {
                    counts.set(key, (counts.get(key) || 0) + 1);
                });

                const uniqueFields = counts.size;
                const maxDuplicates = Math.max(...counts.values());

                // Rule 1: We need at least 2 distinct fields (e.g. Room + Price) to be confident
                if (uniqueFields < 2) return;

                // Rule 2: If any single field appears more than 3 times, it's suspicious
                if (maxDuplicates > 3) return;

                if (map.size > 0) {
                    // Rule 3: Must have Price and Room fields (Core data)
                    const hasPrice = Array.from(map.values()).includes('gia_tien');
                    const hasRoom = Array.from(map.values()).includes('so_phong');

                    if (hasPrice && hasRoom) {
                        bestMap = map;
                    }
                }
            }
        });

        return bestMap;
    }

    private async detectHeaderMapByAI(sheet: ExcelJS.Worksheet): Promise<Map<number, keyof RoomRecord>> {
        const sampleRows: any[][] = [];
        sheet.eachRow((row, rowNumber) => {
            if (rowNumber > 20) return;
            // Use values directly to preserve column indices (ExcelJS uses 1-based sparse array for row.values)
            const values = Array.isArray(row.values) ? row.values.slice(1) : [];
            // Fill gaps with empty string to align columns for AI
            const cleanValues = values.map(v => v === undefined || v === null ? '' : String(v));
            sampleRows.push(cleanValues);
        });

        return await this.aiMapper.getMapping(sampleRows);
    }

    private isSectionHeader(row: ExcelJS.Row): boolean {
        const values = this.getRowValues(row);
        if (values.length > 5) return false; // Data rows usually have many columns

        if (values.length === 0) return false;

        const firstVal = String(values[0]).trim();

        if (firstVal.toLowerCase().includes('nguồn hàng') || firstVal.toLowerCase().includes('bảng hàng')) return false; // Skip file titles

        if (firstVal.toLowerCase().startsWith('địa chỉ')) return true;
        if (firstVal.toLowerCase().startsWith('nhà số')) return true;
        if (firstVal.toLowerCase().startsWith('số ')) return true;
        if (firstVal.match(/^\d+(\/|\s+)/)) return true;

        const cell1 = row.getCell(1);
        // @ts-ignore
        if (cell1.isMerged && values.length <= 2 && firstVal.length > 5 && !firstVal.toLowerCase().includes('stt')) {
            return true;
        }

        return false;
    }

    private extractAddress(row: ExcelJS.Row): string {
        const values = this.getRowValues(row);
        // Join all text in the row just in case
        return values.join(' ').replace(/^địa chỉ:?/i, '').trim();
    }

    private isHeaderRow(row: ExcelJS.Row): boolean {
        let matches = 0;
        row.eachCell((cell) => {
            const val = String(cell.value).toLowerCase();
            if (val.length > 50) return; // Header cells are usually short

            if (val.includes('phòng') || val.includes('mã') || val.includes('số phòng')) matches++;
            if (val.includes('giá') || val.includes('cọc') || val.includes('tiền')) matches++;
            if (val.includes('ảnh')) matches++;
            if (val.includes('trạng thái') || val.includes('tình trạng')) matches++;
            if (val.includes('ghi chú')) matches++;
        });
        return matches >= 2;
    }

    private checkRowHasData(row: ExcelJS.Row, headerMap: Map<number, keyof RoomRecord>): boolean {
        let dataCount = 0;
        headerMap.forEach((key, colIdx) => {
            const cell = row.getCell(colIdx);
            if (cell.value !== null && cell.value !== undefined && String(cell.value).trim() !== '') {
                dataCount++;
            }
        });
        return dataCount >= 1; // At least 1 mapped column has data
    }

    private mapHeaders(row: ExcelJS.Row): Map<number, keyof RoomRecord> {
        const map = new Map<number, keyof RoomRecord>();
        row.eachCell((cell, colNumber) => {
            const val = String(cell.value).toLowerCase().trim();
            if (val.length > 50) return; // Ignore long text for headers

            // Exact matches first?

            // Fuzzy matches
            for (const [key, field] of Object.entries(this.columnMap)) {
                if (val.includes(key)) {
                    if (field !== 'ignore') {
                        map.set(colNumber, field as keyof RoomRecord);
                    }
                    break;
                }
            }
        });
        return map;
    }

    private parseRecord(row: ExcelJS.Row, headerMap: Map<number, keyof RoomRecord>, fileSourceId: string): RoomRecord | null {
        // Requirement said: "Mọi logic code phải tuân thủ... id_phong = ... + địa chỉ..."
        // So address is mandatory.

        const record: Partial<RoomRecord> = {
            dia_chi: this.currentAddress,
            file_source_id: fileSourceId,
            ghi_chu: ''
        };

        let hasData = false;

        row.eachCell((cell, colNumber) => {
            const field = headerMap.get(colNumber);
            if (field) {
                let val = cell.value;
                if (typeof val === 'object' && val !== null && 'text' in val) {
                    val = (val as any).text; // Handle rich text or hyperlinks if simple
                }

                if (field === 'gia_tien') {
                    record[field] = this.cleanPrice(val);
                } else if (field === 'so_phong') {
                    record[field] = String(val);
                } else {
                    // @ts-ignore
                    record[field] = String(val);
                }
                hasData = true;
            } else {
                // Collect unmapped data into ghi_chu
                const val = String(cell.value);
                if (val && val.length < 100) { // Avoid huge text
                    record.ghi_chu += `${val}; `;
                }
            }
        });

        if (!hasData) return null;
        if (!record.so_phong) return null; // Mandatory field?
        if (!record.dia_chi) return null; // Mandatory field

        // Generate ID
        // 10 chars of file_id + address + room
        // Simple hash to keep it consistent
        const rawId = `${fileSourceId}_${record.dia_chi}_${record.so_phong}`;
        record.id_phong = this.generateId(rawId);

        // Normalize status
        const statusRaw = String(record.trang_thai || '').toLowerCase();
        if (statusRaw.includes('cọc') || statusRaw.includes('đã')) {
            record.trang_thai = 'DA_COC';
        } else {
            record.trang_thai = 'TRONG';
        }

        return record as RoomRecord;
    }

    private cleanPrice(val: any): number {
        if (!val) return 0;
        const str = String(val).toLowerCase().replace(/,/g, '').replace(/\./g, ''); // Remove commas/dots first? CAREFUL with decimals.
        // Heuristic: "5.5 tr" -> 5500000
        // If raw is 5500000 (number) -> 5500000

        if (typeof val === 'number') return val;

        let numStr = String(val).toLowerCase();
        let multiplier = 1;

        if (numStr.includes('tr')) {
            multiplier = 1000000;
            numStr = numStr.replace('tr', '').trim();
        }

        // Remove non-numeric except dot
        const clean = numStr.replace(/[^0-9.]/g, '');
        const num = parseFloat(clean);

        if (isNaN(num)) return 0;
        return num * multiplier;
    }

    private generateId(raw: string): string {
        // Placeholder deterministic ID
        return raw.replace(/[^a-zA-Z0-9]/g, '').slice(0, 30);
    }

    private getRowValues(row: ExcelJS.Row): any[] {
        const values: any[] = [];
        row.eachCell({ includeEmpty: false }, (cell) => {
            values.push(cell.value);
        });
        return values;
    }
}
