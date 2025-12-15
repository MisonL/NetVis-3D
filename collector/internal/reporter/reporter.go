package reporter

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/netvis/collector/internal/collector"
	"github.com/netvis/collector/internal/config"
	"github.com/sirupsen/logrus"
)

// Reporter 数据上报器
type Reporter struct {
	config     *config.Config
	logger     *logrus.Logger
	httpClient *http.Client
	buffer     []collector.DeviceMetrics
	bufferSize int
}

// New 创建上报器实例
func New(cfg *config.Config, logger *logrus.Logger) *Reporter {
	return &Reporter{
		config: cfg,
		logger: logger,
		httpClient: &http.Client{
			Timeout: cfg.API.Timeout,
		},
		buffer:     make([]collector.DeviceMetrics, 0),
		bufferSize: 100,
	}
}

// Start 启动上报器
func (r *Reporter) Start(ctx context.Context, metricsCh <-chan collector.DeviceMetrics) error {
	r.logger.Info("Starting reporter...")

	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			r.flush()
			return nil
		case metrics := <-metricsCh:
			r.buffer = append(r.buffer, metrics)
			if len(r.buffer) >= r.bufferSize {
				r.flush()
			}
		case <-ticker.C:
			if len(r.buffer) > 0 {
				r.flush()
			}
		}
	}
}

// flush 批量上报数据
func (r *Reporter) flush() {
	if len(r.buffer) == 0 {
		return
	}

	data := r.buffer
	r.buffer = make([]collector.DeviceMetrics, 0)

	if err := r.report(data); err != nil {
		r.logger.WithError(err).Error("Failed to report metrics")
		// 重新放回buffer
		r.buffer = append(data, r.buffer...)
	}
}

// report 上报数据到API
func (r *Reporter) report(metrics []collector.DeviceMetrics) error {
	payload := map[string]interface{}{
		"collectorId": r.config.Collector.ID,
		"timestamp":   time.Now().UTC(),
		"metrics":     metrics,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	url := fmt.Sprintf("%s/collector/metrics", r.config.API.Endpoint)
	req, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if r.config.API.Token != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", r.config.API.Token))
	}

	resp, err := r.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("server returned status %d", resp.StatusCode)
	}

	r.logger.WithField("count", len(metrics)).Info("Metrics reported successfully")
	return nil
}

// RegisterCollector 注册采集器
func (r *Reporter) RegisterCollector() error {
	payload := map[string]interface{}{
		"id":        r.config.Collector.ID,
		"name":      r.config.Collector.Name,
		"version":   "1.0.0",
		"status":    "online",
		"startedAt": time.Now().UTC(),
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	url := fmt.Sprintf("%s/collector/register", r.config.API.Endpoint)
	req, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if r.config.API.Token != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", r.config.API.Token))
	}

	resp, err := r.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("registration failed with status %d", resp.StatusCode)
	}

	r.logger.Info("Collector registered successfully")
	return nil
}

// Heartbeat 发送心跳
func (r *Reporter) Heartbeat() error {
	payload := map[string]interface{}{
		"id":        r.config.Collector.ID,
		"status":    "online",
		"timestamp": time.Now().UTC(),
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("%s/collector/heartbeat", r.config.API.Endpoint)
	req, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	if r.config.API.Token != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", r.config.API.Token))
	}

	resp, err := r.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

// GetDevices 从API获取设备列表
func (r *Reporter) GetDevices() ([]collector.Device, error) {
	url := fmt.Sprintf("%s/collector/devices", r.config.API.Endpoint)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	if r.config.API.Token != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", r.config.API.Token))
	}

	resp, err := r.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("server returned status %d", resp.StatusCode)
	}

	var result struct {
		Code    int                `json:"code"`
		Message string             `json:"message"`
		Data    []collector.Device `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	if result.Code != 0 {
		return nil, fmt.Errorf("api error: %s", result.Message)
	}

	return result.Data, nil
}
