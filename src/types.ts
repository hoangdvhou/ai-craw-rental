export interface RoomRecord {
    id_phong: string; // generated: 10 chars of file_id + address + room
    dia_chi: string; // stateful from section header
    quan: string;
    so_phong: string;
    gia_tien: number;
    trang_thai: 'TRONG' | 'DA_COC';
    loai_phong?: string;
    link_anh?: string;
    noi_that?: string;
    dich_vu?: string;
    file_source_id: string; // original filename or provided ID
    sdt_quan_ly?: string;
    ghi_chu?: string; // catch-all
}

export interface ProcessingStats {
    totalRows: number;
    processedRooms: number;
    errors: number;
}
