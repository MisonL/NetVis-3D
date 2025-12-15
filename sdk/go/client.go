// Package netvis provides a Go SDK for the NetVis Pro API.
//
// Example usage:
//
//	client := netvis.NewClient("http://localhost:21301")
//	err := client.Login("admin", "password")
//	if err != nil {
//	    log.Fatal(err)
//	}
//
//	devices, err := client.GetDevices(nil)
//	if err != nil {
//	    log.Fatal(err)
//	}
//
//	for _, device := range devices {
//	    fmt.Printf("Device: %s (%s)\n", device.Name, device.Status)
//	}
package netvis

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// Client is the NetVis API client.
type Client struct {
	baseURL    string
	token      string
	httpClient *http.Client
}

// NewClient creates a new NetVis API client.
func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// SetToken sets the authentication token.
func (c *Client) SetToken(token string) {
	c.token = token
}

// APIResponse represents a generic API response.
type APIResponse[T any] struct {
	Code    int    `json:"code"`
	Message string `json:"message,omitempty"`
	Data    T      `json:"data"`
}

// Pagination represents pagination info.
type Pagination struct {
	Page     int `json:"page"`
	PageSize int `json:"pageSize"`
	Total    int `json:"total"`
}

// PaginatedResponse represents a paginated response.
type PaginatedResponse[T any] struct {
	List       []T        `json:"list"`
	Pagination Pagination `json:"pagination"`
}

// User represents a user.
type User struct {
	ID          string     `json:"id"`
	Username    string     `json:"username"`
	Email       string     `json:"email"`
	DisplayName string     `json:"displayName,omitempty"`
	Role        string     `json:"role"`
	IsActive    bool       `json:"isActive"`
	LastLoginAt *time.Time `json:"lastLoginAt,omitempty"`
	CreatedAt   time.Time  `json:"createdAt"`
}

// LoginResponse represents a login response.
type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

// Device represents a network device.
type Device struct {
	ID         string     `json:"id"`
	Name       string     `json:"name"`
	Type       string     `json:"type"`
	Vendor     string     `json:"vendor,omitempty"`
	Model      string     `json:"model,omitempty"`
	IPAddress  string     `json:"ipAddress,omitempty"`
	MACAddress string     `json:"macAddress,omitempty"`
	Location   string     `json:"location,omitempty"`
	Status     string     `json:"status"`
	LastSeen   *time.Time `json:"lastSeen,omitempty"`
	CreatedAt  time.Time  `json:"createdAt"`
	UpdatedAt  time.Time  `json:"updatedAt"`
}

// CreateDeviceRequest represents a request to create a device.
type CreateDeviceRequest struct {
	Name      string `json:"name"`
	Type      string `json:"type"`
	Vendor    string `json:"vendor,omitempty"`
	Model     string `json:"model,omitempty"`
	IPAddress string `json:"ipAddress,omitempty"`
	Location  string `json:"location,omitempty"`
}

// UpdateDeviceRequest represents a request to update a device.
type UpdateDeviceRequest struct {
	Name      *string `json:"name,omitempty"`
	Vendor    *string `json:"vendor,omitempty"`
	Model     *string `json:"model,omitempty"`
	IPAddress *string `json:"ipAddress,omitempty"`
	Location  *string `json:"location,omitempty"`
}

// DeviceQuery represents query parameters for devices.
type DeviceQuery struct {
	Page     int
	PageSize int
	Status   string
	Type     string
	Search   string
}

// Alert represents an alert.
type Alert struct {
	ID             string     `json:"id"`
	DeviceID       string     `json:"deviceId,omitempty"`
	RuleID         string     `json:"ruleId,omitempty"`
	Severity       string     `json:"severity"`
	Status         string     `json:"status"`
	Message        string     `json:"message"`
	Details        string     `json:"details,omitempty"`
	AcknowledgedBy string     `json:"acknowledgedBy,omitempty"`
	AcknowledgedAt *time.Time `json:"acknowledgedAt,omitempty"`
	ResolvedBy     string     `json:"resolvedBy,omitempty"`
	ResolvedAt     *time.Time `json:"resolvedAt,omitempty"`
	CreatedAt      time.Time  `json:"createdAt"`
}

// AlertQuery represents query parameters for alerts.
type AlertQuery struct {
	Page     int
	PageSize int
	Severity string
	Status   string
	DeviceID string
}

// ConfigBackup represents a configuration backup.
type ConfigBackup struct {
	ID          string    `json:"id"`
	DeviceID    string    `json:"deviceId"`
	DeviceName  string    `json:"deviceName,omitempty"`
	Type        string    `json:"type"`
	Version     string    `json:"version"`
	Size        int       `json:"size"`
	Hash        string    `json:"hash"`
	Description string    `json:"description,omitempty"`
	CreatedBy   string    `json:"createdBy,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
}

// ConfigDiff represents a configuration diff result.
type ConfigDiff struct {
	Added     []string `json:"added"`
	Removed   []string `json:"removed"`
	Modified  []string `json:"modified"`
	Unchanged int      `json:"unchanged"`
}

// DeviceMetrics represents device metrics.
type DeviceMetrics struct {
	DeviceID    string    `json:"deviceId"`
	CPUUsage    float64   `json:"cpuUsage,omitempty"`
	MemoryUsage float64   `json:"memoryUsage,omitempty"`
	Uptime      int64     `json:"uptime,omitempty"`
	Latency     float64   `json:"latency,omitempty"`
	PacketLoss  float64   `json:"packetLoss,omitempty"`
	Timestamp   time.Time `json:"timestamp"`
}

// request performs an HTTP request.
func (c *Client) request(method, path string, body interface{}, result interface{}) error {
	var bodyReader io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("failed to marshal body: %w", err)
		}
		bodyReader = bytes.NewReader(jsonBody)
	}

	req, err := http.NewRequest(method, c.baseURL+path, bodyReader)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	if err := json.Unmarshal(respBody, result); err != nil {
		return fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return nil
}

// Login authenticates with the API.
func (c *Client) Login(username, password string) error {
	var resp APIResponse[LoginResponse]
	err := c.request("POST", "/api/auth/login", map[string]string{
		"username": username,
		"password": password,
	}, &resp)
	if err != nil {
		return err
	}
	if resp.Code != 0 {
		return fmt.Errorf("login failed: %s", resp.Message)
	}
	c.token = resp.Data.Token
	return nil
}

// GetCurrentUser returns the current user.
func (c *Client) GetCurrentUser() (*User, error) {
	var resp APIResponse[User]
	err := c.request("GET", "/api/auth/me", nil, &resp)
	if err != nil {
		return nil, err
	}
	return &resp.Data, nil
}

// GetDevices returns a list of devices.
func (c *Client) GetDevices(query *DeviceQuery) ([]Device, *Pagination, error) {
	path := "/api/devices"
	if query != nil {
		params := url.Values{}
		if query.Page > 0 {
			params.Set("page", fmt.Sprintf("%d", query.Page))
		}
		if query.PageSize > 0 {
			params.Set("pageSize", fmt.Sprintf("%d", query.PageSize))
		}
		if query.Status != "" {
			params.Set("status", query.Status)
		}
		if query.Type != "" {
			params.Set("type", query.Type)
		}
		if query.Search != "" {
			params.Set("search", query.Search)
		}
		if len(params) > 0 {
			path += "?" + params.Encode()
		}
	}

	var resp APIResponse[PaginatedResponse[Device]]
	err := c.request("GET", path, nil, &resp)
	if err != nil {
		return nil, nil, err
	}
	return resp.Data.List, &resp.Data.Pagination, nil
}

// GetDevice returns a single device.
func (c *Client) GetDevice(id string) (*Device, error) {
	var resp APIResponse[Device]
	err := c.request("GET", "/api/devices/"+id, nil, &resp)
	if err != nil {
		return nil, err
	}
	return &resp.Data, nil
}

// CreateDevice creates a new device.
func (c *Client) CreateDevice(req *CreateDeviceRequest) (*Device, error) {
	var resp APIResponse[Device]
	err := c.request("POST", "/api/devices", req, &resp)
	if err != nil {
		return nil, err
	}
	return &resp.Data, nil
}

// UpdateDevice updates a device.
func (c *Client) UpdateDevice(id string, req *UpdateDeviceRequest) (*Device, error) {
	var resp APIResponse[Device]
	err := c.request("PUT", "/api/devices/"+id, req, &resp)
	if err != nil {
		return nil, err
	}
	return &resp.Data, nil
}

// DeleteDevice deletes a device.
func (c *Client) DeleteDevice(id string) error {
	var resp APIResponse[any]
	return c.request("DELETE", "/api/devices/"+id, nil, &resp)
}

// GetAlerts returns a list of alerts.
func (c *Client) GetAlerts(query *AlertQuery) ([]Alert, *Pagination, error) {
	path := "/api/alerts"
	if query != nil {
		params := url.Values{}
		if query.Page > 0 {
			params.Set("page", fmt.Sprintf("%d", query.Page))
		}
		if query.PageSize > 0 {
			params.Set("pageSize", fmt.Sprintf("%d", query.PageSize))
		}
		if query.Severity != "" {
			params.Set("severity", query.Severity)
		}
		if query.Status != "" {
			params.Set("status", query.Status)
		}
		if query.DeviceID != "" {
			params.Set("deviceId", query.DeviceID)
		}
		if len(params) > 0 {
			path += "?" + params.Encode()
		}
	}

	var resp APIResponse[PaginatedResponse[Alert]]
	err := c.request("GET", path, nil, &resp)
	if err != nil {
		return nil, nil, err
	}
	return resp.Data.List, &resp.Data.Pagination, nil
}

// AcknowledgeAlert acknowledges an alert.
func (c *Client) AcknowledgeAlert(id string) error {
	var resp APIResponse[any]
	return c.request("POST", "/api/alerts/"+id+"/acknowledge", nil, &resp)
}

// ResolveAlert resolves an alert.
func (c *Client) ResolveAlert(id string) error {
	var resp APIResponse[any]
	return c.request("POST", "/api/alerts/"+id+"/resolve", nil, &resp)
}

// GetConfigBackups returns configuration backups.
func (c *Client) GetConfigBackups(deviceID string) ([]ConfigBackup, error) {
	path := "/api/config/backups"
	if deviceID != "" {
		path += "?deviceId=" + deviceID
	}

	var resp APIResponse[PaginatedResponse[ConfigBackup]]
	err := c.request("GET", path, nil, &resp)
	if err != nil {
		return nil, err
	}
	return resp.Data.List, nil
}

// CompareConfigs compares two configuration backups.
func (c *Client) CompareConfigs(backupID1, backupID2 string) (*ConfigDiff, error) {
	var resp APIResponse[ConfigDiff]
	err := c.request("POST", "/api/config/compare", map[string]string{
		"backupId1": backupID1,
		"backupId2": backupID2,
	}, &resp)
	if err != nil {
		return nil, err
	}
	return &resp.Data, nil
}

// GetDeviceMetrics returns metrics for a device.
func (c *Client) GetDeviceMetrics(deviceID, timeRange string) ([]DeviceMetrics, error) {
	path := "/api/metrics/" + deviceID
	if timeRange != "" {
		path += "?range=" + timeRange
	}

	var resp APIResponse[[]DeviceMetrics]
	err := c.request("GET", path, nil, &resp)
	if err != nil {
		return nil, err
	}
	return resp.Data, nil
}
