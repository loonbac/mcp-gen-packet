// ── Interface-per-model catalog ──
// Built manually from Cisco Packet Tracer device specifications.
// Covers the most common device families used in network labs.

export const modelInterfaces: Map<string, string[]> = new Map([
  // ── ROUTERS (type 0) ──
  [
    "2911",
    [
      "GigabitEthernet0/0",
      "GigabitEthernet0/1",
      "GigabitEthernet0/2",
      "Serial0/0/0",
      "Serial0/0/1",
    ],
  ],
  [
    "2901",
    [
      "GigabitEthernet0/0",
      "GigabitEthernet0/1",
      "Serial0/0/0",
      "Serial0/0/1",
    ],
  ],
  [
    "1941",
    [
      "GigabitEthernet0/0",
      "GigabitEthernet0/1",
    ],
  ],
  [
    "1841",
    [
      "FastEthernet0/0",
      "FastEthernet0/1",
      "Serial0/0/0",
      "Serial0/0/1",
    ],
  ],
  [
    "2620XM",
    [
      "FastEthernet0/0",
      "Serial0/0",
    ],
  ],
  [
    "2621XM",
    [
      "FastEthernet0/0",
      "FastEthernet0/1",
      "Serial0/0",
    ],
  ],
  [
    "2811",
    [
      "FastEthernet0/0",
      "FastEthernet0/1",
      "Serial0/0/0",
      "Serial0/0/1",
    ],
  ],
  [
    "ISR4321",
    [
      "GigabitEthernet0/0/0",
      "GigabitEthernet0/0/1",
    ],
  ],
  [
    "ISR4331",
    [
      "GigabitEthernet0/0/0",
      "GigabitEthernet0/0/1",
      "GigabitEthernet0/0/2",
    ],
  ],
  [
    "Router-PT",
    [
      "GigabitEthernet0/0",
      "GigabitEthernet0/1",
    ],
  ],

  // ── SWITCHES (type 1) ──
  [
    "2960-24TT",
    [
      "FastEthernet0/1", "FastEthernet0/2", "FastEthernet0/3", "FastEthernet0/4",
      "FastEthernet0/5", "FastEthernet0/6", "FastEthernet0/7", "FastEthernet0/8",
      "FastEthernet0/9", "FastEthernet0/10", "FastEthernet0/11", "FastEthernet0/12",
      "FastEthernet0/13", "FastEthernet0/14", "FastEthernet0/15", "FastEthernet0/16",
      "FastEthernet0/17", "FastEthernet0/18", "FastEthernet0/19", "FastEthernet0/20",
      "FastEthernet0/21", "FastEthernet0/22", "FastEthernet0/23", "FastEthernet0/24",
      "GigabitEthernet0/1", "GigabitEthernet0/2",
    ],
  ],
  [
    "2950-24",
    [
      "FastEthernet0/1", "FastEthernet0/2", "FastEthernet0/3", "FastEthernet0/4",
      "FastEthernet0/5", "FastEthernet0/6", "FastEthernet0/7", "FastEthernet0/8",
      "FastEthernet0/9", "FastEthernet0/10", "FastEthernet0/11", "FastEthernet0/12",
      "FastEthernet0/13", "FastEthernet0/14", "FastEthernet0/15", "FastEthernet0/16",
      "FastEthernet0/17", "FastEthernet0/18", "FastEthernet0/19", "FastEthernet0/20",
      "FastEthernet0/21", "FastEthernet0/22", "FastEthernet0/23", "FastEthernet0/24",
    ],
  ],
  [
    "2950T-24",
    [
      "FastEthernet0/1", "FastEthernet0/2", "FastEthernet0/3", "FastEthernet0/4",
      "FastEthernet0/5", "FastEthernet0/6", "FastEthernet0/7", "FastEthernet0/8",
      "FastEthernet0/9", "FastEthernet0/10", "FastEthernet0/11", "FastEthernet0/12",
      "FastEthernet0/13", "FastEthernet0/14", "FastEthernet0/15", "FastEthernet0/16",
      "FastEthernet0/17", "FastEthernet0/18", "FastEthernet0/19", "FastEthernet0/20",
      "FastEthernet0/21", "FastEthernet0/22", "FastEthernet0/23", "FastEthernet0/24",
      "GigabitEthernet0/1", "GigabitEthernet0/2",
    ],
  ],
  [
    "Switch-PT",
    [
      "FastEthernet0/1", "FastEthernet0/2",
    ],
  ],

  // ── MULTILAYER SWITCHES (type 16) ──
  [
    "3560-24PS",
    [
      "FastEthernet0/1", "FastEthernet0/2", "FastEthernet0/3", "FastEthernet0/4",
      "FastEthernet0/5", "FastEthernet0/6", "FastEthernet0/7", "FastEthernet0/8",
      "FastEthernet0/9", "FastEthernet0/10", "FastEthernet0/11", "FastEthernet0/12",
      "FastEthernet0/13", "FastEthernet0/14", "FastEthernet0/15", "FastEthernet0/16",
      "FastEthernet0/17", "FastEthernet0/18", "FastEthernet0/19", "FastEthernet0/20",
      "FastEthernet0/21", "FastEthernet0/22", "FastEthernet0/23", "FastEthernet0/24",
      "GigabitEthernet0/1", "GigabitEthernet0/2",
    ],
  ],
  [
    "3650-24PS",
    [
      "GigabitEthernet0/1", "GigabitEthernet0/2", "GigabitEthernet0/3", "GigabitEthernet0/4",
      "GigabitEthernet0/5", "GigabitEthernet0/6", "GigabitEthernet0/7", "GigabitEthernet0/8",
      "GigabitEthernet0/9", "GigabitEthernet0/10", "GigabitEthernet0/11", "GigabitEthernet0/12",
      "GigabitEthernet0/13", "GigabitEthernet0/14", "GigabitEthernet0/15", "GigabitEthernet0/16",
      "GigabitEthernet0/17", "GigabitEthernet0/18", "GigabitEthernet0/19", "GigabitEthernet0/20",
      "GigabitEthernet0/21", "GigabitEthernet0/22", "GigabitEthernet0/23", "GigabitEthernet0/24",
    ],
  ],

  // ── END DEVICES (type 8, 9) ──
  ["PC-PT", ["FastEthernet0"]],
  ["Server-PT", ["FastEthernet0"]],
  ["Laptop-PT", ["FastEthernet0", "Wireless0"]],
  ["TabletPC-PT", ["Wireless0"]],
  ["SMARTPHONE-PT", ["Wireless0"]],
  ["Printer-PT", ["FastEthernet0"]],

  // ── ASA FIREWALL ──
  [
    "5505",
    [
      "GigabitEthernet0/0", "GigabitEthernet0/1", "GigabitEthernet0/2",
      "GigabitEthernet0/3", "GigabitEthernet0/4", "GigabitEthernet0/5",
    ],
  ],
  [
    "5506-X",
    [
      "GigabitEthernet0/0", "GigabitEthernet0/1", "GigabitEthernet0/2",
      "GigabitEthernet0/3", "GigabitEthernet0/4", "GigabitEthernet0/5",
      "GigabitEthernet0/6", "GigabitEthernet0/7",
    ],
  ],

  // ── WIRELESS ──
  ["AccessPoint-PT", ["Port0"]],
  [
    "Linksys-WRT300N",
    [
      "Internet", "Port1", "Port2", "Port3", "Port4",
    ],
  ],
]);
