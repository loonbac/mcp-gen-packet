export interface Context {
  readonly [key: string]: unknown;
}

export interface Stage<TContext extends object = Context> {
  execute(context: Readonly<TContext>): TContext | Promise<TContext>;
}

/**
 * Generic, typed, immutable pipeline runner.
 * Stages are chained via .pipe() and executed sequentially via .execute().
 */
export class Pipeline<TContext extends object = Context> {
  private readonly stages: readonly Stage<TContext>[];

  constructor(stages?: readonly Stage<TContext>[]) {
    this.stages = stages ? [...stages] : [];
  }

  pipe(stage: Stage<TContext>): Pipeline<TContext> {
    return new Pipeline<TContext>([...this.stages, stage]);
  }

  async execute(initialContext: TContext): Promise<TContext> {
    let current = initialContext;
    for (const stage of this.stages) {
      current = await stage.execute(current);
    }
    return current;
  }
}
