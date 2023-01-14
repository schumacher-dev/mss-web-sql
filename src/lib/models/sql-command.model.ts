export class SqlCommand {
    query: string; 
    binds?: Array<any> | Array<Array<any>>;

    constructor(query: string, binds?: Array<any> | Array<Array<any>>) {
        this.query = query;
        this.binds = binds;
    }
}