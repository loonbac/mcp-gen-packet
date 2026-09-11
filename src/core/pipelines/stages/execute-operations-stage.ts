import type { Stage } from "../pipeline.js";
import type { OperationExecution, OperationsContext } from "../types.js";

/**
 * Sequential batch operation execution pipeline stage.
 * Executes planned operations against an OperationBridge, capturing per-operation
 * outcomes without failing the overall pipeline or aborting subsequent operations.
 */
export class ExecuteOperationsStage<
  TContext extends OperationsContext = OperationsContext,
> implements Stage<TContext> {
  async execute(context: Readonly<TContext>): Promise<TContext> {
    const executionResults: OperationExecution[] = [];

    for (const op of context.operations) {
      try {
        await context.bridge.execute(op.method, op.params);
        executionResults.push({
          success: true,
          method: op.method,
          params: op.params,
        });
      } catch {
        executionResults.push({
          success: false,
          method: op.method,
          params: op.params,
        });
      }
    }

    return {
      ...context,
      executionResults,
    };
  }
}
