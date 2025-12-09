/**
 * @typedef {Object} Device
 * @property {string} id - Unique device identifier
 * @property {string} type - Device type (cloud, firewall, core-switch, agg-switch, server, database, storage)
 * @property {string} label - Display name
 * @property {string} ip - IP address
 * @property {string} status - Status (online, offline, warning)
 * @property {string} location - Physical location
 * @property {string} [uptime] - Uptime duration
 * @property {string} [traffic] - Traffic volume
 * @property {string[]} [alerts] - Active alerts
 */

/**
 * @typedef {Object} Link
 * @property {string} source - Source device ID
 * @property {string} target - Target device ID
 * @property {number} traffic - Traffic indicator (0 = no animation, 1 = animated)
 */

/**
 * Mock device data
 * @type {Device[]}
 */
export const mockDevices = [
    // Level 1: Internet & Firewall
    { 
        id: 'cloud', 
        type: 'cloud', 
        label: 'Internet', 
        ip: '8.8.8.8', 
        status: 'online', 
        location: 'Global',
        traffic: 'Unlimited'
    },
    { 
        id: 'fw-1', 
        type: 'firewall', 
        label: '边界防火墙', 
        ip: '202.10.1.1', 
        status: 'online', 
        location: '机房 A-FW',
        uptime: '365 days',
        traffic: '450 Mbps'
    },
    
    // Level 2: Core
    { 
        id: 'core-sw', 
        type: 'core-switch', 
        label: '核心交换机', 
        ip: '10.0.0.1', 
        status: 'online', 
        location: '机房 A-Core',
        uptime: '180 days',
        traffic: '12.5 Gbps'
    },

    // Level 3: Aggregation
    { 
        id: 'agg-sw-1', 
        type: 'agg-switch', 
        label: '汇聚交换机 A (Web)', 
        ip: '10.0.1.1', 
        status: 'online', 
        location: '机房 B-01',
        uptime: '120 days',
        traffic: '4.2 Gbps'
    },
    { 
        id: 'agg-sw-2', 
        type: 'agg-switch', 
        label: '汇聚交换机 B (Data)', 
        ip: '10.0.2.1', 
        status: 'online', 
        location: '机房 B-02',
        uptime: '120 days',
        traffic: '3.8 Gbps'
    },

    // Level 4: Servers - Web Cluster
    { 
        id: 'web-1', 
        type: 'server', 
        label: 'Web Server 01', 
        ip: '10.0.1.11', 
        status: 'online', 
        location: '机房 C-01',
        traffic: '800 Mbps'
    },
    { 
        id: 'web-2', 
        type: 'server', 
        label: 'Web Server 02', 
        ip: '10.0.1.12', 
        status: 'warning', 
        location: '机房 C-02',
        traffic: '1.2 Gbps',
        alerts: ['High Memory Usage']
    },
    { 
        id: 'web-3', 
        type: 'server', 
        label: 'Web Server 03', 
        ip: '10.0.1.13', 
        status: 'online', 
        location: '机房 C-03',
        traffic: '600 Mbps'
    },

    // Level 4: Servers - Data Cluster
    { 
        id: 'db-master', 
        type: 'database', 
        label: 'DB Master', 
        ip: '10.0.2.10', 
        status: 'online', 
        location: '机房 D-01',
        uptime: '400 days',
        traffic: '2.4 Gbps'
    },
    { 
        id: 'db-slave', 
        type: 'database', 
        label: 'DB Slave', 
        ip: '10.0.2.11', 
        status: 'online', 
        location: '机房 D-02',
        traffic: '1.8 Gbps'
    },
    { 
        id: 'storage-1', 
        type: 'storage', 
        label: 'NAS Storage', 
        ip: '10.0.2.20', 
        status: 'online', 
        location: '机房 D-05',
        traffic: '500 Mbps'
    }
];

/**
 * Mock link data for topology connections
 * @type {Link[]}
 */
export const mockLinks = [
    { source: 'cloud', target: 'fw-1', traffic: 1 },
    { source: 'fw-1', target: 'core-sw', traffic: 1 },
    { source: 'core-sw', target: 'agg-sw-1', traffic: 1 },
    { source: 'core-sw', target: 'agg-sw-2', traffic: 1 },
    { source: 'agg-sw-1', target: 'web-1', traffic: 0 },
    { source: 'agg-sw-1', target: 'web-2', traffic: 1 },
    { source: 'agg-sw-1', target: 'web-3', traffic: 0 },
    { source: 'agg-sw-2', target: 'db-master', traffic: 1 },
    { source: 'agg-sw-2', target: 'db-slave', traffic: 0 },
    { source: 'agg-sw-2', target: 'storage-1', traffic: 0 },
];

/**
 * Get device details by ID
 * @param {string} id - Device ID
 * @returns {Promise<Device | undefined>}
 */
export const getDeviceDetails = (id) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(mockDevices.find(d => d.id === id));
        }, 100);
    });
};

