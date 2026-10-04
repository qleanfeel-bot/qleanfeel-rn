declare const unitOfWorkContextBrand: unique symbol;

export interface UnitOfWorkContext {
  readonly [unitOfWorkContextBrand]: true;
}

export abstract class UnitOfWork {
  /**
   * Runs one coordinated application operation in a transaction. Participating
   * repositories receive the same opaque context; nested execute() calls are
   * unsupported and must be composed into the active operation instead.
   */
  abstract execute<T>(
    operation: (context: UnitOfWorkContext) => Promise<T>,
  ): Promise<T>;
}
