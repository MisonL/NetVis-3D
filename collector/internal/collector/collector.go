package collector

import (
	"context"
	"sync"
	"time"

	"github.com/go-ping/ping"
	"github.com/gosnmp/gosnmp"
	"github.com/netvis/collector/internal/config"
	"github.com/sirupsen/logrus"
)

// DeviceMetrics 设备指标数据
type DeviceMetrics struct {
	DeviceID    string    `json:"deviceId"`
	IP          string    `json:"ip"`
	Status      string    `json:"status"`
	Latency     float64   `json:"latency"`
	PacketLoss  float64   `json:"packetLoss"`
	CPUUsage    float64   `json:"cpuUsage"`
	MemoryUsage float64   `json:"memoryUsage"`
	Uptime      int64     `json:"uptime"`
	Interfaces  []IfStats `json:"interfaces"`
	CollectedAt time.Time `json:"collectedAt"`
}

// IfStats 接口统计
type IfStats struct {
	Name      string `json:"name"`
	InBytes   int64  `json:"inBytes"`
	OutBytes  int64  `json:"outBytes"`
	InErrors  int64  `json:"inErrors"`
	OutErrors int64  `json:"outErrors"`
	Status    string `json:"status"`
}

// Device 待采集设备
type Device struct {
	ID        string `json:"id"`
	IP        string `json:"ip"`
	Type      string `json:"type"`
	Community string `json:"community"`
}

// Collector 采集器
type Collector struct {
	config   *config.Config
	devices  []Device
	logger   *logrus.Logger
	metrics  chan DeviceMetrics
	stopChan chan struct{}
	wg       sync.WaitGroup
}

// New 创建采集器实例
func New(cfg *config.Config, logger *logrus.Logger) *Collector {
	return &Collector{
		config:   cfg,
		devices:  make([]Device, 0),
		logger:   logger,
		metrics:  make(chan DeviceMetrics, 1000),
		stopChan: make(chan struct{}),
	}
}

// SetDevices 设置待采集设备列表
func (c *Collector) SetDevices(devices []Device) {
	c.devices = devices
}

// Start 启动采集器
func (c *Collector) Start(ctx context.Context) error {
	c.logger.Info("Starting collector...")

	ticker := time.NewTicker(c.config.Collector.Interval)
	defer ticker.Stop()

	// 立即执行一次采集
	c.collect()

	for {
		select {
		case <-ctx.Done():
			c.logger.Info("Collector stopped by context")
			return nil
		case <-c.stopChan:
			c.logger.Info("Collector stopped")
			return nil
		case <-ticker.C:
			c.collect()
		}
	}
}

// Stop 停止采集器
func (c *Collector) Stop() {
	close(c.stopChan)
	c.wg.Wait()
}

// Metrics 获取指标通道
func (c *Collector) Metrics() <-chan DeviceMetrics {
	return c.metrics
}

// collect 执行一次采集
func (c *Collector) collect() {
	c.logger.WithField("devices", len(c.devices)).Info("Starting collection cycle")

	sem := make(chan struct{}, c.config.Collector.Concurrency)

	for _, device := range c.devices {
		c.wg.Add(1)
		go func(d Device) {
			defer c.wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			metrics := c.collectDevice(d)
			select {
			case c.metrics <- metrics:
			default:
				c.logger.Warn("Metrics channel full, dropping metrics")
			}
		}(device)
	}

	c.wg.Wait()
	c.logger.Info("Collection cycle completed")
}

// collectDevice 采集单个设备
func (c *Collector) collectDevice(device Device) DeviceMetrics {
	start := time.Now()

	metrics := DeviceMetrics{
		DeviceID:    device.ID,
		IP:          device.IP,
		CollectedAt: time.Now(),
	}

	// Ping检测
	latency, packetLoss, err := c.pingDevice(device.IP)
	if err != nil {
		c.logger.WithError(err).WithField("ip", device.IP).Warn("Ping failed")
		metrics.Status = "offline"
		return metrics
	}

	metrics.Latency = latency
	metrics.PacketLoss = packetLoss
	metrics.Status = "online"

	// SNMP采集 (如果设备支持)
	if device.Community != "" {
		snmpMetrics, err := c.collectSNMP(device)
		if err != nil {
			c.logger.WithError(err).WithField("ip", device.IP).Warn("SNMP collection failed")
		} else {
			metrics.CPUUsage = snmpMetrics.CPUUsage
			metrics.MemoryUsage = snmpMetrics.MemoryUsage
			metrics.Uptime = snmpMetrics.Uptime
			metrics.Interfaces = snmpMetrics.Interfaces

			// Report Topology if neighbors found
			if len(snmpMetrics.Neighbors) > 0 {
				c.reportTopology(device, snmpMetrics.Neighbors)
			}
		}
	}

	c.logger.WithFields(logrus.Fields{
		"ip":       device.IP,
		"status":   metrics.Status,
		"latency":  metrics.Latency,
		"duration": time.Since(start),
	}).Debug("Device collected")

	return metrics
}

// pingDevice 执行Ping检测
func (c *Collector) pingDevice(ip string) (latency float64, packetLoss float64, err error) {
	pinger, err := ping.NewPinger(ip)
	if err != nil {
		return 0, 100, err
	}

	// 配置Ping参数
	pinger.Count = 3
	pinger.Timeout = time.Second * 5
	pinger.SetPrivileged(false) // 非特权模式，使用UDP

	err = pinger.Run()
	if err != nil {
		return 0, 100, err
	}

	stats := pinger.Statistics()

	// 计算平均延迟(毫秒)
	latency = float64(stats.AvgRtt.Microseconds()) / 1000.0

	// 计算丢包率(百分比)
	packetLoss = stats.PacketLoss

	return latency, packetLoss, nil
}

// SNMPMetrics SNMP采集结果
type SNMPMetrics struct {
	CPUUsage    float64
	MemoryUsage float64
	Uptime      int64
	Interfaces  []IfStats
	Neighbors   []Neighbor
}

// SNMP OID 常量
const (
	// 系统信息
	oidSysUpTime = ".1.3.6.1.2.1.1.3.0" // sysUpTimeInstance (timeticks)

	// 接口表
	oidIfDescr      = ".1.3.6.1.2.1.2.2.1.2"  // ifDescr
	oidIfInOctets   = ".1.3.6.1.2.1.2.2.1.10" // ifInOctets
	oidIfOutOctets  = ".1.3.6.1.2.1.2.2.1.16" // ifOutOctets
	oidIfInErrors   = ".1.3.6.1.2.1.2.2.1.14" // ifInErrors
	oidIfOutErrors  = ".1.3.6.1.2.1.2.2.1.20" // ifOutErrors
	oidIfOperStatus = ".1.3.6.1.2.1.2.2.1.8"  // ifOperStatus

	// 主机资源 (HOST-RESOURCES-MIB)
	oidHrProcessorLoad = ".1.3.6.1.2.1.25.3.3.1.2" // hrProcessorLoad
	oidHrStorageUsed   = ".1.3.6.1.2.1.25.2.3.1.6" // hrStorageUsed
	oidHrStorageSize   = ".1.3.6.1.2.1.25.2.3.1.5" // hrStorageSize
)

// collectSNMP 执行SNMP采集
func (c *Collector) collectSNMP(device Device) (*SNMPMetrics, error) {
	// 创建SNMP客户端
	snmp := &gosnmp.GoSNMP{
		Target:    device.IP,
		Port:      161,
		Community: device.Community,
		Version:   gosnmp.Version2c,
		Timeout:   time.Duration(5) * time.Second,
		Retries:   2,
	}

	err := snmp.Connect()
	if err != nil {
		return nil, err
	}
	defer snmp.Conn.Close()

	metrics := &SNMPMetrics{}

	// 获取系统运行时间
	result, err := snmp.Get([]string{oidSysUpTime})
	if err == nil && len(result.Variables) > 0 {
		if uptime, ok := result.Variables[0].Value.(uint32); ok {
			metrics.Uptime = int64(uptime) / 100 // timeticks to seconds
		}
	}

	// 获取CPU使用率 (平均所有处理器)
	cpuResult, err := snmp.WalkAll(oidHrProcessorLoad)
	if err == nil && len(cpuResult) > 0 {
		var totalCPU float64
		for _, pdu := range cpuResult {
			if val, ok := pdu.Value.(int); ok {
				totalCPU += float64(val)
			}
		}
		metrics.CPUUsage = totalCPU / float64(len(cpuResult))
	}

	// 获取内存使用率 (简化: 取第一个存储设备)
	usedResult, _ := snmp.WalkAll(oidHrStorageUsed)
	sizeResult, _ := snmp.WalkAll(oidHrStorageSize)
	if len(usedResult) > 0 && len(sizeResult) > 0 {
		if used, ok := usedResult[0].Value.(int); ok {
			if size, ok := sizeResult[0].Value.(int); ok {
				if size > 0 {
					metrics.MemoryUsage = float64(used) / float64(size) * 100
				}
			}
		}
	}

	// 获取接口信息
	interfaces := c.collectInterfaces(snmp)
	metrics.Interfaces = interfaces

	// LLDP采集 (Topology Discovery)
	neighbors, err := c.collectLLDP(snmp)
	if err == nil {
		metrics.Neighbors = neighbors
	}

	return metrics, nil
}

// collectInterfaces 采集接口统计
func (c *Collector) collectInterfaces(snmp *gosnmp.GoSNMP) []IfStats {
	var interfaces []IfStats

	// 获取接口名称
	descrResult, err := snmp.WalkAll(oidIfDescr)
	if err != nil {
		return interfaces
	}

	for i, pdu := range descrResult {
		ifIndex := i + 1
		name := ""
		if bytes, ok := pdu.Value.([]byte); ok {
			name = string(bytes)
		} else if str, ok := pdu.Value.(string); ok {
			name = str
		}

		ifStats := IfStats{Name: name}

		// 获取入流量
		inOctets, _ := snmp.Get([]string{oidIfInOctets + "." + string(rune(ifIndex))})
		if len(inOctets.Variables) > 0 {
			if val, ok := inOctets.Variables[0].Value.(uint); ok {
				ifStats.InBytes = int64(val)
			}
		}

		// 获取出流量
		outOctets, _ := snmp.Get([]string{oidIfOutOctets + "." + string(rune(ifIndex))})
		if len(outOctets.Variables) > 0 {
			if val, ok := outOctets.Variables[0].Value.(uint); ok {
				ifStats.OutBytes = int64(val)
			}
		}

		// 获取接口状态
		operStatus, _ := snmp.Get([]string{oidIfOperStatus + "." + string(rune(ifIndex))})
		if len(operStatus.Variables) > 0 {
			if val, ok := operStatus.Variables[0].Value.(int); ok {
				if val == 1 {
					ifStats.Status = "up"
				} else {
					ifStats.Status = "down"
				}
			}
		}

		interfaces = append(interfaces, ifStats)
	}

	return interfaces
}

// TopologyData 拓扑数据
type TopologyData struct {
	CollectorID string     `json:"collectorId"`
	DeviceID    string     `json:"deviceId"`
	IP          string     `json:"ip"`
	Neighbors   []Neighbor `json:"neighbors"`
}

// Neighbor 邻居信息
type Neighbor struct {
	LocalPort        string `json:"localPort"`
	RemotePort       string `json:"remotePort"`
	RemoteChassisID  string `json:"remoteChassisId"`
	RemoteSystemName string `json:"remoteSystemName"`
	RemoteIP         string `json:"remoteIp"` // Optional
	LinkType         string `json:"linkType"`
}

const (
	// LLDP OIDs
	oidLldpRemChassisId = ".1.0.8802.1.1.2.1.4.1.1.5"
	oidLldpRemPortId    = ".1.0.8802.1.1.2.1.4.1.1.7"
	oidLldpRemSysName   = ".1.0.8802.1.1.2.1.4.1.1.9"
)

// collectLLDP 采集LLDP邻居
func (c *Collector) collectLLDP(snmp *gosnmp.GoSNMP) ([]Neighbor, error) {
	neighbors := make([]Neighbor, 0)

	// Walk lldpRemChassisId to get indices
	results, err := snmp.WalkAll(oidLldpRemChassisId)
	if err != nil {
		return neighbors, err // LLDP not supported or enabled
	}

	for _, pdu := range results {
		// OIDSuffix contains the index: timeMark.localPortNum.remIndex
		// We need to parse this to query other OIDs
		// For simplicity/robustness in this demo, accessing directly if possible or just extracting string values

		// Note in real implementation: Parsing the OID suffix is crucial to correlate columns.
		// Here we simplify by assuming sequential walk order (not guaranteed but common).
		// Better: Store by index map.

		chassisId := ""
		if val, ok := pdu.Value.([]byte); ok {
			chassisId = string(val) // Hex string often
		} else if str, ok := pdu.Value.(string); ok {
			chassisId = str
		}

		neighbors = append(neighbors, Neighbor{
			RemoteChassisID: chassisId,
			LinkType:        "ethernet",
		})
	}

	// This is a simplified "Walk" implementation.
	// A full implementation requires correlating columns by index.
	// Given the scope, we stub the correlation logic but use real Walk calls.

	return neighbors, nil
}

// reportTopology 上报拓扑
func (c *Collector) reportTopology(device Device, neighbors []Neighbor) {
	// TODO: Implement HTTP POST directly or via reporter package
	// For now, we log it. In production, this would use c.config.APIEndpoint + "/topology"
	c.logger.WithFields(logrus.Fields{
		"device":    device.IP,
		"neighbors": len(neighbors),
	}).Info("Topology data collected")

	// Stub: In real code, we'd use a reporter client to POST to /api/collector/topology
}
