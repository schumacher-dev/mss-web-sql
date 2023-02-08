# MssWebSql

## Usage

###  Add MssWebsqlModule on your Angular project

```typescript
@NgModule({
    ...
    imports: [
        MssWebsqlModule
    ]
})
export class AppModule { }
```

---
### Create your migration
```typescript
export class TesteMigration implements ISQLMigration {
    id: string = 'teste'; // Migration Identification
    description: string = 'Table for test';
    order: number = 10; // Execution order
    
    resolveDo(): string {
        return `
            CREATE TABLE "Teste" (
                "Id" INT UNIQUE, 
                "Name" VARCHAR, 
                "CreatedAt" TIMESTAMP
            );
        `;
    }

    resolveUndo(): string {
        return `
            DROP TABLE "Teste";
        `;
    }

}
```
---
## Add service in your component
```typescript
@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss']
})
export class AppComponent {
    title = 'test-mss-websql';

    constructor(
        private webSql: MssWebsqlService,
        private webSqlMigrations: MssWebsqlMigrationsService
    ) {

    }

    async ngOnInit() {
        // Initialize Database
        await this.webSql.init('TestMssWebSqlMigrations', '1.0', 'teste');

        // Initialize Migrations Management Service
        await this.webSqlMigrations.init();

        // Add your migration to Migrations Service
        await this.webSqlMigrations.addMigrations([
            new TesteMigration()
        ]);
    }
}
````

---
## Other utilities
```typescript
    // This method can be used to run one SQL command
    await this.webSql.execute('SELECT * FROM User WHERE Email = $1', ['test@email.com']);

    // This method can be used to run many SQL commands with a transaction
    await this.webSql.transaction([
        'YOUR SQL 1',
        'YOUR SQL 2',
        'YOUR SQL 3',
        ...
    ]);
````

