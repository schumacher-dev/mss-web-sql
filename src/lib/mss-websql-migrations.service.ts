import { Injectable } from '@angular/core';
import { MigrationEntity } from './models/migration.entity';
import { MigrationsConfig } from './models/migrations-config';
import { ISQLMigration } from './models/sql-migrations.interface';
import { generateHash } from './utils/generate-hash';
import { MssWebsqlService } from './mss-websql.service';

@Injectable({
  providedIn: 'root'
})
export class MssWebsqlMigrationsService {

    private migrations: Array<ISQLMigration> = [];
    private isNewVersion: boolean = false;
    private migrationsTable: string = '_Migrations';
    private migrationsConfigTable: string = '_MigrationsConfig';

    constructor(
        private webSql: MssWebsqlService
    ) { }

    private async sync() {
        let dbMigrations = await this.getDbMigrations();
        this.isNewVersion = await this.checkIsNewVersion();

        console.log('sync: IS NEW VERSION', this.isNewVersion)
        if (!this.isNewVersion) return;

        // REMOVE DATABASE MIGRATIONS
        for (const dMigration of dbMigrations) {
            const _mig = this.migrations.find(m => m.id == dMigration.Id)
            
            if (!_mig) {
                await this.webSql.execute(`DELETE FROM "${this.migrationsTable}" WHERE "Id" = '${dMigration.Id}'`)
            }
        }

        // SYNC MEMORY MIGRATION WITH DATABASE
        for (const migration of this.migrations) {
            let m = dbMigrations.find(m => m.Id == migration.id)
            console.log(`sync: FIND MIGRATION ${m?.Id}`, m);

            if (m) {
                console.log(`sync: MIGRATION ${m.Id} SET EXECUTED AS ${m.Executed === 1 ? true : false}`)
                migration.executed = m.Executed === 1 ? true : false;
            } else {
                await this.addMigrationOnDatabase(migration);
            }
        }

        let versionHash = await this.getMigrationsHash();
        await this.updateVersionHash(versionHash);
    }

    async init() {
        let hasTableMigrations = await this.webSql.checkTableExist(this.migrationsTable);
        let hasTableMigrationsConfig = await this.webSql.checkTableExist(this.migrationsConfigTable);

        if (!hasTableMigrations) {
            await this.webSql.execute(`
                CREATE TABLE ${this.migrationsTable} (
                    Id VARCHAR UNIQUE, 
                    Position INT,
                    Executed BOOLEAN, 
                    ExecutedAt TEXT, 
                    CreatedAt TIMESTAMP
                );
            `);
        }

        if (!hasTableMigrationsConfig) {
            await this.webSql.execute(`
                CREATE TABLE ${this.migrationsConfigTable} (
                    Id INT UNIQUE,
                    Hash VARCHAR,
                    UpdatedAt TIMESTAMP
                );
            `);

            await this.webSql.execute(
                `INSERT INTO ${this.migrationsConfigTable} (Id, Hash) VALUES (1, '')`
            );
        }
    }

    async doAllMigrations() {
        return this.doMigrations({});
    }

    async undoAllMigrations() {
        return this.undoMigrations({});
    }

    async doMigrations(config: MigrationsConfig = {
        qty: 1
    }) {
        if (!this.hasMigrations()) {
            throw new Error("Migrations not defined, use method 'addMigrations' before run");
        }
        
        // if (!this.isNewVersion) return;
        let migrations: Array<ISQLMigration>;

        migrations = this.migrations
                                .filter(e => !e.executed)
                                .sort((a, b) => a.order - b.order);

        if (config.qty)
            migrations = migrations.slice(0, config.qty);

        await this.runMigrations(migrations, 'do');
    }

    async undoMigrations(config: MigrationsConfig = {
        qty: 1
    }) {
        if (!this.hasMigrations()) {
            throw new Error("Migrations not defined, use method 'addMigrations' before run");
        }

        let migrations: Array<ISQLMigration>;

        migrations = this.migrations
                        .filter(e => e.executed === true)
                        .sort((a, b) => b.order - a.order);

        if (config.qty)
            migrations = migrations.slice(0, config.qty);

        await this.runMigrations(migrations, 'undo');
        await this.updateVersionHash('');
    }

    async runMigrations(migrations: Array<ISQLMigration>, type: 'do' | 'undo') {
        try {
            console.log('\n');
            console.log('>>> RUN MIGRATIONS START --------------------------------------------------- ');

            for (const migration of migrations) {
                try {
                    await this._runOneMigration(type, migration);
                } catch (error) {
                    console.log('Error on execute migration', migration.id);
                    throw error;
                }
            }

            console.log('<<< RUN MIGRATIONS END ----------------------------------------------------- ');
            console.log('\n');
            return true;
        } catch (error: any) {
            console.log('RUN MIGRATIONS ERROR', error);
            throw new Error(error.message);
        }
    }

    async addMigrations(migrations: Array<ISQLMigration>) {
        for (const migration of migrations) {
            await this.addMigration(migration);
        }

        await this.sync();
    }

    private async checkIsNewVersion() {
        let mHash = this.getMigrationsHash();
        let dbHash = await this.getDbHash();

        return (mHash !== dbHash);
    }

    private async getDbHash() {
        let result = await this.webSql.execute(
            `SELECT Hash FROM ${this.migrationsConfigTable};`
        );

        if (result.rows.length == 0) return '';
        else return result.rows[0].Hash;
    }

    private getMigrationsHash(): string {
        let str: string = '';
        for (const m of this.migrations) {
            str += `[${m.id}:${m.order},${m.resolveDo()},${m.resolveUndo()}]`;
        }

        return generateHash(str).toString();
    }

    private async getDbMigrations(where?: string): Promise<Array<MigrationEntity>> {
        where = (!where) ? '' : `WHERE ${where} `;

        let qResult = await this.webSql.execute<MigrationEntity>(
            `SELECT * FROM "${this.migrationsTable}" ${where} ORDER BY "Position"`
        );

        console.log('getDbMigrations: MIGRATIONS', [...qResult.rows]);

        return [...qResult.rows];
    }

    private hasMigrations() {
        return this.migrations.length > 0;
    }

    private async updateVersionHash(hash: string) {
        await this.webSql.execute(
            `UPDATE ${this.migrationsConfigTable} SET Hash = '${hash}', UpdatedAt = ${(new Date().getTime())}`
        );
    }

    private async _runOneMigration(type: 'do' | 'undo', migration: ISQLMigration) {
        console.log(`::: >>> START RUN MIGRATION ${migration.id} ------------------- `);
        let result: any;

        if (type == 'do') {
            if (migration.executed === true) {
                console.log(`runOneMigration: MIGRATION ${migration.id} ALREADY EXECUTED`);
                return;
            }

            result = await this._doMigration(migration);
        }
        else if (type == 'undo') {
            if (type == 'undo' && migration.executed === false) {
                console.log(`runOneMigration: MIGRATION ${migration.id} IS NOT EXECUTED YET`);
                return;
            }

            result = await this._undoMigration(migration);
        }
        
        console.log(`::: <<< END RUN MIGRATION ${migration.id} --------------------- `);
        return result;
    }

    private async _doMigration(migration: ISQLMigration): Promise<any> {
        try {
            console.log('DO MIGRATION ', migration.id);

            let result = await this.webSql.execute(
                migration.resolveDo()
            );
                
            await this.webSql.execute(`UPDATE ${this.migrationsTable} SET "Executed" = 1 WHERE "Id" = '${migration.id}'`);
            migration.executed = true;

            return result;
        } catch (error) {
            console.error(`DO MIGRATION ERROR ${migration.id}`, error)
        }
    }

    private async _undoMigration(migration: ISQLMigration): Promise<any> {
        try {
            console.log('UNDO MIGRATION ', migration.id);

            let result = await this.webSql.execute(
                migration.resolveUndo()
            );
            
            await this.webSql.execute(`UPDATE ${this.migrationsTable} SET "Executed" = 0 WHERE "Id" = '${migration.id}'`);
            migration.executed = false;

            return result;
        } catch (error) {
            console.error(`UNDO MIGRATION ERROR ${migration.id}`, error)
        }
    }

    private async checkMigrationExists(migration: ISQLMigration) {
        let queryResult = await this.webSql.execute(
            `SELECT * FROM "${this.migrationsTable}" WHERE "Id" = '${migration.id}'`
        );

        return (queryResult.rows.length > 0) ? true : false;
    }

    private async addMigration(migration: ISQLMigration) {
        this.migrations.push(migration);
        
        let migrationExists = await this.checkMigrationExists(migration);
        if (migrationExists) return;

        await this.addMigrationOnDatabase(migration);
    }

    private async addMigrationOnDatabase(migration: ISQLMigration) {
        await this.webSql.execute(
            `INSERT INTO "${this.migrationsTable}" ("Id", "Position", "Executed", "CreatedAt") VALUES (?, ?, ?, ?)`,
            [migration.id, migration.order, 0, (new Date().getTime())]
        );
    }

    private async getDbMigrationById(id: string) {
        let result = await this.getDbMigrations(`Id = '${id}'`);
        return (result.length > 0) ? result[0] : null;
    }

}