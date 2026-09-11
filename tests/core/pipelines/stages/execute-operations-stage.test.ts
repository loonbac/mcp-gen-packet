import { describe, it, expect, vi } from "vitest";
import { Pipeline } from "../../../../src/core/pipelines/pipeline.js";
import { ExecuteOperationsStage } from "../../../../src/core/pipelines/stages/execute-operations-stage.js";
import type {
  PlannedOperation,
  OperationBridge,
  OperationsContext,
} from "../../../../src/core/pipelines/types.js";

describe("ExecuteOperationsStage", () => {
  it("should execute all planned operations sequentially against the bridge", async () => {
    const executedCalls: Array<{ method: string; params: Record<string, unknown> }> = [];

    const mockBridge: OperationBridge = {
      execute: vi.fn().mockImplementation(async (method: string, params: Record<string, unknown>) => {
        executedCalls.push({ method, params });
        return { ok: true };
      }),
    };

    const operations: PlannedOperation[] = [
      { method: "add_device", params: { name: "R1", model: "Router-PT" } },
      { method: "add_device", params: { name: "PC1", model: "PC-PT" } },
      { method: "add_link", params: { device1: "R1", device2: "PC1" } },
    ];

    const context: OperationsContext = {
      bridge: mockBridge,
      operations,
      executionResults: [],
    };

    const stage = new ExecuteOperationsStage();
    const result = await stage.execute(context);

    expect(mockBridge.execute).toHaveBeenCalledTimes(3);
    expect(executedCalls).toEqual([
      { method: "add_device", params: { name: "R1", model: "Router-PT" } },
      { method: "add_device", params: { name: "PC1", model: "PC-PT" } },
      { method: "add_link", params: { device1: "R1", device2: "PC1" } },
    ]);

    expect(result.executionResults).toEqual([
      {
        success: true,
        method: "add_device",
        params: { name: "R1", model: "Router-PT" },
      },
      {
        success: true,
        method: "add_device",
        params: { name: "PC1", model: "PC-PT" },
      },
      {
        success: true,
        method: "add_link",
        params: { device1: "R1", device2: "PC1" },
      },
    ]);
  });

  it("should capture operation failures without throwing and continue executing subsequent operations", async () => {
    const mockBridge: OperationBridge = {
      execute: vi.fn().mockImplementation(async (method: string, params: Record<string, unknown>) => {
        if (params.name === "BAD_DEVICE") {
          throw new Error("Bridge connection failure");
        }
        return { ok: true };
      }),
    };

    const operations: PlannedOperation[] = [
      { method: "add_device", params: { name: "R1" } },
      { method: "add_device", params: { name: "BAD_DEVICE" } },
      { method: "add_device", params: { name: "PC1" } },
    ];

    const context: OperationsContext = {
      bridge: mockBridge,
      operations,
      executionResults: [],
    };

    const stage = new ExecuteOperationsStage();
    const result = await stage.execute(context);

    expect(mockBridge.execute).toHaveBeenCalledTimes(3);
    expect(result.executionResults).toEqual([
      { success: true, method: "add_device", params: { name: "R1" } },
      { success: false, method: "add_device", params: { name: "BAD_DEVICE" } },
      { success: true, method: "add_device", params: { name: "PC1" } },
    ]);
  });

  it("should handle non-Error rejections gracefully", async () => {
    const mockBridge: OperationBridge = {
      execute: vi.fn().mockImplementation(async (_method: string, params: Record<string, unknown>) => {
        if (params.id === "reject-str") {
          return Promise.reject("Raw string rejection");
        }
        if (params.id === "reject-obj") {
          return Promise.reject({ status: 500 });
        }
        return { ok: true };
      }),
    };

    const operations: PlannedOperation[] = [
      { method: "op_1", params: { id: "reject-str" } },
      { method: "op_2", params: { id: "reject-obj" } },
      { method: "op_3", params: { id: "ok" } },
    ];

    const context: OperationsContext = {
      bridge: mockBridge,
      operations,
      executionResults: [],
    };

    const stage = new ExecuteOperationsStage();
    const result = await stage.execute(context);

    expect(result.executionResults).toEqual([
      { success: false, method: "op_1", params: { id: "reject-str" } },
      { success: false, method: "op_2", params: { id: "reject-obj" } },
      { success: true, method: "op_3", params: { id: "ok" } },
    ]);
  });

  it("should handle empty operations list without calling bridge", async () => {
    const mockBridge: OperationBridge = {
      execute: vi.fn().mockResolvedValue({ ok: true }),
    };

    const context: OperationsContext = {
      bridge: mockBridge,
      operations: [],
      executionResults: [],
    };

    const stage = new ExecuteOperationsStage();
    const result = await stage.execute(context);

    expect(mockBridge.execute).not.toHaveBeenCalled();
    expect(result.executionResults).toEqual([]);
  });

  it("should preserve context immutability and retain additional context properties", async () => {
    interface CustomContext extends OperationsContext {
      readonly customTag: string;
      readonly hostCount: number;
    }

    const mockBridge: OperationBridge = {
      execute: vi.fn().mockResolvedValue({ ok: true }),
    };

    const originalOperations: PlannedOperation[] = [
      { method: "test_op", params: { id: 1 } },
    ];

    const originalContext: CustomContext = {
      bridge: mockBridge,
      operations: originalOperations,
      executionResults: [],
      customTag: "vlan-10",
      hostCount: 5,
    };

    const stage = new ExecuteOperationsStage<CustomContext>();
    const result = await stage.execute(originalContext);

    // Context reference identity: must return a new context
    expect(result).not.toBe(originalContext);
    // Original operations array not mutated
    expect(originalContext.operations).toBe(originalOperations);
    expect(originalContext.executionResults).toEqual([]);
    // Additional properties preserved
    expect(result.customTag).toBe("vlan-10");
    expect(result.hostCount).toBe(5);
    expect(result.executionResults).toHaveLength(1);
    expect(result.executionResults[0].success).toBe(true);
  });

  it("should preserve operation parameters unmutated and keep exact references in execution results", async () => {
    const mockBridge: OperationBridge = {
      execute: vi.fn().mockResolvedValue({ ok: true }),
    };

    const paramObj1 = { name: "Switch-1", nested: { vlan: 10 } };
    const paramObj2 = { name: "Host-1", ips: ["10.0.1.2"] };

    const operations: PlannedOperation[] = [
      { method: "add_switch", params: paramObj1 },
      { method: "add_host", params: paramObj2 },
    ];

    const context: OperationsContext = {
      bridge: mockBridge,
      operations,
      executionResults: [],
    };

    const stage = new ExecuteOperationsStage();
    const result = await stage.execute(context);

    // Parameters in execution results must reference exact original objects
    expect(result.executionResults[0].params).toBe(paramObj1);
    expect(result.executionResults[1].params).toBe(paramObj2);
    expect(result.executionResults[0].method).toBe("add_switch");
    expect(result.executionResults[1].method).toBe("add_host");

    // Ensure parameters were not modified
    expect(paramObj1).toEqual({ name: "Switch-1", nested: { vlan: 10 } });
    expect(paramObj2).toEqual({ name: "Host-1", ips: ["10.0.1.2"] });
  });

  it("should integrate seamlessly within a Pipeline runner", async () => {
    const mockBridge: OperationBridge = {
      execute: vi.fn().mockResolvedValue({ ok: true }),
    };

    const pipeline = new Pipeline<OperationsContext>().pipe(new ExecuteOperationsStage());

    const initialContext: OperationsContext = {
      bridge: mockBridge,
      operations: [
        { method: "ping", params: { target: "1.1.1.1" } },
      ],
      executionResults: [],
    };

    const finalContext = await pipeline.execute(initialContext);

    expect(finalContext.executionResults).toEqual([
      { success: true, method: "ping", params: { target: "1.1.1.1" } },
    ]);
  });
});
