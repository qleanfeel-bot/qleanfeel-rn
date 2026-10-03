declare const unitOfWorkContextBrand: unique symbol;

export interface UnitOfWorkContext {
  readonly [unitOfWorkContextBrand]: true;
}

export abstract class UnitOfWork {
  abstract execute<T>(
    operation: (context: UnitOfWorkContext) => Promise<T>,
  ): Promise<T>;
}
