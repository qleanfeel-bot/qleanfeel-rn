import { Injectable } from '@nestjs/common';
import type { UnitOfWorkContext } from '../../application/ports/unit-of-work.js';

@Injectable()
export class TransactionContextRegistry {
  private readonly transactions = new WeakMap<UnitOfWorkContext, unknown>();

  create<TTransaction>(transaction: TTransaction): UnitOfWorkContext {
    const context = Object.freeze({}) as UnitOfWorkContext;
    this.transactions.set(context, transaction);
    return context;
  }

  get<TTransaction>(context: UnitOfWorkContext): TTransaction {
    const transaction = this.transactions.get(context);
    if (transaction === undefined) {
      throw new Error('Transaction context is unknown or no longer active.');
    }

    return transaction as TTransaction;
  }

  release(context: UnitOfWorkContext): void {
    this.transactions.delete(context);
  }
}
