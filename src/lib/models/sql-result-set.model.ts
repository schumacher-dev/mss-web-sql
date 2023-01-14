export interface SQLResultSet<T = any> {
    insertId: any
    rows: Array<T>;
    length: number;
    rowsAffected: number;
};