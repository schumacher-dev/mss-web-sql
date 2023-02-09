# MssWebSql

## Description
This project is an Angular library to manage database migrations using WebSQL in browser. You can create and organize your dababase migrations with intuitive way usign typescript classes.

Available commands:
 - MssWebsqlMigrationsService
    - init = Initialize the migrations management system
    - doAllMigrations = Do all migrations
    - undoAllMigrations = Undo all migrations
    - doMigrations = Do migrations with specific amount
    - undoMigrations = Undo migrations with specific amount
    - runMigrations = Do or Undo specific migrations
    - addMigrations = Add migrations to manage
 - MssWebsqlService
    - init = Initialize the database
    - checkTableExist = Check if an table existe (not default in websql)
    - execute = Execute an SQL command
    - transaction = Execute many SQL commands inside the transaction
    - transactionFn = Allow the transaction usign callback strategy

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
        {
            query: 'YOUR SQL 1',
            binds: []
        },
        {
            query: 'YOUR SQL 2',
            binds: []
        },
        ...
    ]);

    // You can use transactions with callback strategy
    await this.webSql.transactionFn(async transaction => {
        await this.webSql.execute(
            'YOUR QUERY HERE', [... your binds], transaction);
    });
````

