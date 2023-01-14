export interface ISQLMigration {
    id: string;
    order: number;
    description: string;
    executed?: boolean;

    resolveDo(): string;
    resolveUndo(): string;
}