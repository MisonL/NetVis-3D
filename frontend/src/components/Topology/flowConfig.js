import DeviceNode from './nodes/DeviceNode';
import NetworkEdge from './edges/NetworkEdge';

export const nodeTypes = {
  device: DeviceNode,
};

export const edgeTypes = {
  network: NetworkEdge,
};

export const initialPositions = {
    'cloud': { x: 450, y: 0 },
    'fw-1': { x: 450, y: 180 },
    'core-sw': { x: 450, y: 380 },
    'agg-sw-1': { x: 200, y: 580 },
    'agg-sw-2': { x: 700, y: 580 },
    'web-1': { x: 0, y: 800 },
    'web-2': { x: 180, y: 800 },
    'web-3': { x: 360, y: 800 },
    'db-master': { x: 560, y: 800 },
    'db-slave': { x: 740, y: 800 },
    'storage-1': { x: 920, y: 800 },
};
