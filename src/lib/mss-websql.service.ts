import { Injectable } from '@angular/core';
import { CommandFn } from './models/sql-command-fn.model';
import { SqlCommand } from './models/sql-command.model';
import { SQLError } from './models/sql-error.interface';
import { ISQLMigration } from './models/sql-migrations.interface';
import { SQLResultSet } from './models/sql-result-set.model';
import { SQLTransaction } from './models/sql-transaction.type';

declare var window: any;

@Injectable({
  providedIn: 'root'
})
export class MssWebsqlService {

    dbInstance: any;
    migrations: Array<ISQLMigration> = [];

    constructor() {
        
    }

    async init(dbName: string, version: string, description: string, size: number = 200000) {
        this.dbInstance = window.openDatabase(dbName, version, description, size);

        if (!this.dbInstance) {
            alert('Não foi possivel instanciar o banco de dados');
        }
    }

    async checkTableExist(tableName: string) {
        let result = await this.execute(
            `SELECT name FROM sqlite_master WHERE type='table' AND name = '${tableName}';`
        );

        return (result.rows.length == 0) ? false : true;
    }

    async execute<T = any>(sqlQuery: string, binds?: Array<any> | Array<Array<any>>): Promise<SQLResultSet<T>> {
        return new Promise((resolve, reject) => {
            this.dbInstance.transaction(async (transaction: SQLTransaction) => {
                try {
                    let result = await this.run<T>(new SqlCommand(sqlQuery, binds), transaction);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    async transaction(sqlCommands: Array<SqlCommand>): Promise<Array<SQLResultSet<any>>> {
        return new Promise((resolve, reject) => {
            this.dbInstance.transaction(async (transaction: SQLTransaction) => {
                try {
                    let result: Array<any> = [];
                    
                    for (const cmd of sqlCommands) {
                        let res = await this.run<any>(cmd, transaction);
                        result.push(res);
                    }

                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    async transactionFn<T>(commandFunction: CommandFn<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.dbInstance.transaction(async (transaction: SQLTransaction) => {
                try {
                    let result = await commandFunction(transaction)
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    private async run<T>(sqlCommand: SqlCommand, transaction: any): Promise<SQLResultSet<T>> {
        return new Promise((resolve, reject) => {
            transaction.executeSql(
                sqlCommand.query,
                sqlCommand.binds || null,
                function (transaction: SQLTransaction, result: SQLResultSet<T>) {
                    console.log('[QUERY]', sqlCommand.query, result);
                    resolve(result);
                },
                function (transaction: SQLTransaction, error: SQLError) {
                    console.log(error);
                    reject(error);
                }
            );
        });

    }

}