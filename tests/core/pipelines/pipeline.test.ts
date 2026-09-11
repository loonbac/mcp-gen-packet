import { describe, it, expect, vi } from "vitest";
import { Pipeline, type Stage } from "../../../src/core/pipelines/pipeline.js";

interface TestContext {
  count: number;
  log?: string[];
}

describe("Pipeline", () => {
  it("executes synchronous stages sequentially and accumulates context", async () => {
    const stage1: Stage<TestContext> = {
      execute: (ctx) => ({ ...ctx, count: ctx.count + 1 }),
    };
    const stage2: Stage<TestContext> = {
      execute: (ctx) => ({ ...ctx, count: ctx.count * 2 }),
    };

    const pipeline = new Pipeline<TestContext>().pipe(stage1).pipe(stage2);
    const result = await pipeline.execute({ count: 1 });

    expect(result).toEqual({ count: 4 });
  });

  it("awaits asynchronous stages in sequential order", async () => {
    const stage1: Stage<TestContext> = {
      execute: async (ctx) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          ...ctx,
          count: ctx.count + 10,
          log: [...(ctx.log ?? []), "async1"],
        };
      },
    };
    const stage2: Stage<TestContext> = {
      execute: (ctx) => ({
        ...ctx,
        count: ctx.count * 2,
        log: [...(ctx.log ?? []), "sync2"],
      }),
    };

    const pipeline = new Pipeline<TestContext>().pipe(stage1).pipe(stage2);
    const result = await pipeline.execute({ count: 5, log: [] });

    expect(result).toEqual({
      count: 30,
      log: ["async1", "sync2"],
    });
  });

  it("halts execution immediately when a stage throws and does not run subsequent stages", async () => {
    const errorToThrow = new Error("Stage failure simulation");
    const stage1: Stage<TestContext> = {
      execute: (ctx) => ({ ...ctx, count: ctx.count + 1 }),
    };
    const stage2: Stage<TestContext> = {
      execute: () => {
        throw errorToThrow;
      },
    };
    const stage3Execute = vi.fn((ctx: TestContext) => ({ ...ctx, count: ctx.count + 999 }));
    const stage3: Stage<TestContext> = {
      execute: stage3Execute,
    };

    const pipeline = new Pipeline<TestContext>().pipe(stage1).pipe(stage2).pipe(stage3);

    await expect(pipeline.execute({ count: 0 })).rejects.toThrow(errorToThrow);
    expect(stage3Execute).not.toHaveBeenCalled();
  });

  it("preserves exact error identity on asynchronous rejection", async () => {
    class CustomPipelineError extends Error {
      readonly code = "STAGE_ERROR_42";
    }
    const customErr = new CustomPipelineError("Async stage failure");

    const stage1: Stage<TestContext> = {
      execute: async () => {
        throw customErr;
      },
    };

    const pipeline = new Pipeline<TestContext>().pipe(stage1);
    await expect(pipeline.execute({ count: 0 })).rejects.toBe(customErr);
  });

  it("guarantees immutability of .pipe() chaining", async () => {
    const stageAdd1: Stage<TestContext> = {
      execute: (ctx) => ({ ...ctx, count: ctx.count + 1 }),
    };
    const stageAdd10: Stage<TestContext> = {
      execute: (ctx) => ({ ...ctx, count: ctx.count + 10 }),
    };

    const basePipeline = new Pipeline<TestContext>().pipe(stageAdd1);
    const extendedPipeline = basePipeline.pipe(stageAdd10);

    const baseResult = await basePipeline.execute({ count: 0 });
    const extendedResult = await extendedPipeline.execute({ count: 0 });

    expect(baseResult.count).toBe(1);
    expect(extendedResult.count).toBe(11);
  });

  it("returns initial context unchanged when executing an empty pipeline", async () => {
    const emptyPipeline = new Pipeline<TestContext>();
    const initial = { count: 42, log: ["init"] };
    const result = await emptyPipeline.execute(initial);

    expect(result).toBe(initial);
  });
});
