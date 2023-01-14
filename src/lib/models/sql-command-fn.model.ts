import { SQLTransaction } from "./sql-transaction.type";

export type CommandFn<T> = (transaction: SQLTransaction) => Promise<T>;