package main

import (
	"context"
	"flag"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/netvis/collector/internal/collector"
	"github.com/netvis/collector/internal/config"
	"github.com/netvis/collector/internal/reporter"
	"github.com/sirupsen/logrus"
)

var (
	configPath = flag.String("config", "config.yaml", "配置文件路径")
	version    = "1.0.0"
)

func main() {
	flag.Parse()

	// 初始化日志
	logger := logrus.New()
	logger.SetFormatter(&logrus.JSONFormatter{})
	logger.SetOutput(os.Stdout)

	logger.WithField("version", version).Info("Starting NetVis Collector")

	// 加载配置
	cfg, err := config.Load(*configPath)
	if err != nil {
		logger.WithError(err).Fatal("Failed to load config")
	}

	// 环境变量覆盖 (简单实现)
	if envEndpoint := os.Getenv("NETVIS_API_ENDPOINT"); envEndpoint != "" {
		cfg.API.Endpoint = envEndpoint
		logger.WithField("endpoint", envEndpoint).Info("Config overwritten by env: NETVIS_API_ENDPOINT")
	}
	if envToken := os.Getenv("NETVIS_API_TOKEN"); envToken != "" {
		cfg.API.Token = envToken
		logger.Info("Config overwritten by env: NETVIS_API_TOKEN")
	}

	// 设置日志级别
	level, err := logrus.ParseLevel(cfg.Logging.Level)
	if err != nil {
		level = logrus.InfoLevel
	}
	logger.SetLevel(level)

	// 创建上下文
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 创建采集器
	col := collector.New(cfg, logger)

	// 创建上报器
	rep := reporter.New(cfg, logger)

	// 注册采集器
	if err := rep.RegisterCollector(); err != nil {
		logger.WithError(err).Warn("Failed to register collector")
	}

	// 初始获取设备列表
	logger.Info("Fetching devices from API...")
	if devices, err := rep.GetDevices(); err != nil {
		logger.WithError(err).Warn("Failed to fetch initial device list, starting with empty list")
	} else {
		logger.WithField("count", len(devices)).Info("Received device list")
		col.SetDevices(devices)
	}

	// 启动设备列表同步任务
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if devices, err := rep.GetDevices(); err != nil {
					logger.WithError(err).Error("Failed to sync devices")
				} else {
					logger.WithField("count", len(devices)).Debug("Synced device list")
					col.SetDevices(devices)
				}
			}
		}
	}()

	// 启动心跳
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := rep.Heartbeat(); err != nil {
					logger.WithError(err).Warn("Heartbeat failed")
				}
			}
		}
	}()

	// 启动采集器
	go func() {
		if err := col.Start(ctx); err != nil {
			logger.WithError(err).Error("Collector stopped with error")
		}
	}()

	// 启动上报器
	go func() {
		if err := rep.Start(ctx, col.Metrics()); err != nil {
			logger.WithError(err).Error("Reporter stopped with error")
		}
	}()

	// 等待信号
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	logger.Info("Shutting down...")
	cancel()
	col.Stop()

	logger.Info("Collector stopped")
}
