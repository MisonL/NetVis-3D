package collector

import (
	"context"
	"sync"
	"time"

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
	// 简化实现 - 实际应使用 go-ping 库
	return 10.5, 0, nil
}

// SNMPMetrics SNMP采集结果
type SNMPMetrics struct {
	CPUUsage    float64
	MemoryUsage float64
	Uptime      int64
	Interfaces  []IfStats
}

// collectSNMP 执行SNMP采集
func (c *Collector) collectSNMP(device Device) (*SNMPMetrics, error) {
	// 简化实现 - 实际应使用 gosnmp 库
	return &SNMPMetrics{
		CPUUsage:    25.5,
		MemoryUsage: 60.2,
		Uptime:      86400,
		Interfaces: []IfStats{
			{Name: "eth0", InBytes: 1024000, OutBytes: 512000, Status: "up"},
			{Name: "eth1", InBytes: 2048000, OutBytes: 1024000, Status: "up"},
		},
	}, nil
}
