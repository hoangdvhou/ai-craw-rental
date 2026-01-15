import ExcelJS from 'exceljs';
import { RoomRecord } from './types';
import { v4 as uuidv4 } from 'uuid';

export class ExcelProcessor {
    private currentAddress: string = '';
    private currentDistrict: string = '';

    // Fuzzy mapping for columns
    private readonly columnMap: Record<string, keyof RoomRecord | 'ignore'> = {
        'phòng': 'so_phong',
        'số phòng': 'so_phong',
        'mã phòng': 'so_phong',
        'mã': 'so_phong', // specific context
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
        'stt': 'ignore',
        'số tt': 'ignore'
    };

    /**
     * Entry point to process a single file.
     */
    async processFile(filePath: string, fileSourceId: string): Promise<RoomRecord[]> {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);

        const records: RoomRecord[] = [];

        // Check all visible sheets
        workbook.worksheets.forEach(sheet => {
            if (sheet.state !== 'visible') return;

            console.log(`Processing sheet: ${sheet.name}`);
            this.currentAddress = '';
            let headerMap: Map<number, keyof RoomRecord> = new Map();

            sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
                if (row.hidden) return;

                const rowValuesStr = this.getRowValues(row).map(v => String(v).trim()).join(' | ');

                // State 1: Check for Section Header (Address)
                if (this.isSectionHeader(row)) {
                    this.currentAddress = this.extractAddress(row);
                    console.log(`[DEBUG] Found Address: ${this.currentAddress}`);
                    return;
                }

                // State 2: Check for Column Headers
                if (this.isHeaderRow(row)) {
                    const newMap = this.mapHeaders(row);
                    if (newMap.size > 0) {
                        headerMap = newMap;
                        console.log(`[DEBUG] Mapped headers at row ${rowNumber}:`, Object.fromEntries(headerMap));
                    } else {
                        console.log(`[DEBUG] Header candidates found but mapping failed at row ${rowNumber}: ${rowValuesStr}`);
                    }
                    return;
                }

                // State 3: Data Row
                if (headerMap.size > 0) {
                    const hasMappedData = this.checkRowHasData(row, headerMap);

                    if (hasMappedData) {
                        const record = this.parseRecord(row, headerMap, fileSourceId);
                        if (record) {
                            records.push(record);
                        }
                    }
                }
            });
        });

        return records;
    }

    private isSectionHeader(row: ExcelJS.Row): boolean {
        const values = this.getRowValues(row);
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
        // If we don't have a current address, we can't create a valid record strictly speaking.
        // But maybe we can fallback or alert? 
        // Requirement said: "Mọi logic code phải tuân thủ... id_phong = ... + địa chỉ..."
        // So address is mandatory.
        if (!this.currentAddress) return null;

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
