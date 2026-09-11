export interface SubnetAllocation {
  readonly subnet: string;
  readonly allocator: SubnetAllocator;
}

/**
 * Immutable subnet allocator generating sequential /24 subnets.
 * State transitions are modeled via newly returned SubnetAllocator instances.
 */
export class SubnetAllocator {
  readonly prefix: string;
  readonly nextIndex: number;

  constructor(prefix: string = "10.0", nextIndex: number = 1) {
    this.prefix = prefix;
    this.nextIndex = nextIndex;
  }

  next(): SubnetAllocation {
    return {
      subnet: `${this.prefix}.${this.nextIndex}.0`,
      allocator: new SubnetAllocator(this.prefix, this.nextIndex + 1),
    };
  }
}
