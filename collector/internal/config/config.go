package config

import (
	"os"
	"time"

	"gopkg.in/yaml.v3"
)

type Config struct {
	API       APIConfig       `yaml:"api"`
	Collector CollectorConfig `yaml:"collector"`
	SNMP      SNMPConfig      `yaml:"snmp"`
	Ping      PingConfig      `yaml:"ping"`
	Logging   LoggingConfig   `yaml:"logging"`
	Metrics   MetricsConfig   `yaml:"metrics"`
}

type APIConfig struct {
	Endpoint   string        `yaml:"endpoint"`
	Token      string        `yaml:"token"`
	Timeout    time.Duration `yaml:"timeout"`
	RetryCount int           `yaml:"retryCount"`
}

type CollectorConfig struct {
	ID          string        `yaml:"id"`
	Name        string        `yaml:"name"`
	Interval    time.Duration `yaml:"interval"`
	Concurrency int           `yaml:"concurrency"`
}

type SNMPConfig struct {
	Community string        `yaml:"community"`
	Version   string        `yaml:"version"`
	Timeout   time.Duration `yaml:"timeout"`
	Retries   int           `yaml:"retries"`
	Port      int           `yaml:"port"`
}

type PingConfig struct {
	Count    int           `yaml:"count"`
	Timeout  time.Duration `yaml:"timeout"`
	Interval time.Duration `yaml:"interval"`
}

type LoggingConfig struct {
	Level  string `yaml:"level"`
	Format string `yaml:"format"`
	Output string `yaml:"output"`
	File   string `yaml:"file"`
}

type MetricsConfig struct {
	Enabled bool   `yaml:"enabled"`
	Port    int    `yaml:"port"`
	Path    string `yaml:"path"`
}

func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	config := &Config{}
	if err := yaml.Unmarshal(data, config); err != nil {
		return nil, err
	}

	// 设置默认值
	if config.Collector.Interval == 0 {
		config.Collector.Interval = 60 * time.Second
	}
	if config.Collector.Concurrency == 0 {
		config.Collector.Concurrency = 10
	}
	if config.SNMP.Port == 0 {
		config.SNMP.Port = 161
	}
	if config.Ping.Count == 0 {
		config.Ping.Count = 3
	}

	return config, nil
}
