import React, { useState, useEffect } from 'react';
import { 
  Modal, Form, Input, Select, Switch, message, 
  Row, Col, Divider, Space, Button 
} from 'antd';
import { 
  CloudServerOutlined, WifiOutlined, DesktopOutlined, 
  SafetyCertificateOutlined, GlobalOutlined 
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';

const { Option } = Select;
const { TextArea } = Input;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const DeviceFormModal = ({ visible, device, onClose, onSuccess }) => {
  const { token } = useAuth();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const isEdit = !!device;

  useEffect(() => {
    if (visible && device) {
      form.setFieldsValue({
        name: device.name,
        label: device.label,
        type: device.type,
        vendor: device.vendor,
        model: device.model,
        ipAddress: device.ipAddress,
        macAddress: device.macAddress,
        location: device.location,
        status: device.status,
      });
    } else if (visible) {
      form.resetFields();
    }
  }, [visible, device, form]);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const url = isEdit 
        ? `${API_BASE}/api/devices/${device.id}`
        : `${API_BASE}/api/devices`;
      
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      });

      const data = await res.json();
      if (data.code === 0) {
        message.success(isEdit ? '设备更新成功' : '设备创建成功');
        onSuccess?.();
        onClose();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  const deviceTypes = [
    { value: 'router', label: '路由器', icon: <GlobalOutlined /> },
    { value: 'switch', label: '交换机', icon: <WifiOutlined /> },
    { value: 'firewall', label: '防火墙', icon: <SafetyCertificateOutlined /> },
    { value: 'server', label: '服务器', icon: <CloudServerOutlined /> },
    { value: 'ap', label: '无线AP', icon: <WifiOutlined /> },
    { value: 'other', label: '其他', icon: <DesktopOutlined /> },
  ];

  const vendors = [
    'Cisco', 'Huawei', 'H3C', 'Ruijie', 'Juniper', 
    'Nokia', 'Arista', 'Dell', 'Fortinet', 'Palo Alto', 'Other'
  ];

  return (
    <Modal
      title={isEdit ? '编辑设备' : '新增设备'}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={640}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{ type: 'router', status: 'unknown' }}
      >
        <Divider orientation="left" plain>基本信息</Divider>
        
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="name"
              label="设备名称"
              rules={[{ required: true, message: '请输入设备名称' }]}
            >
              <Input placeholder="如: Core-Router-01" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="label"
              label="设备标签"
            >
              <Input placeholder="显示在拓扑图上的标签" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="type"
              label="设备类型"
              rules={[{ required: true, message: '请选择设备类型' }]}
            >
              <Select>
                {deviceTypes.map(t => (
                  <Option key={t.value} value={t.value}>
                    <Space>
                      {t.icon}
                      {t.label}
                    </Space>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="status"
              label="状态"
            >
              <Select>
                <Option value="online">在线</Option>
                <Option value="offline">离线</Option>
                <Option value="warning">告警</Option>
                <Option value="error">故障</Option>
                <Option value="unknown">未知</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left" plain>厂商信息</Divider>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="vendor"
              label="厂商"
            >
              <Select allowClear showSearch placeholder="选择或输入厂商">
                {vendors.map(v => (
                  <Option key={v} value={v}>{v}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="model"
              label="型号"
            >
              <Input placeholder="设备型号" />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left" plain>网络配置</Divider>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="ipAddress"
              label="IP 地址"
              rules={[
                { 
                  pattern: /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
                  message: 'IP 地址格式不正确',
                },
              ]}
            >
              <Input placeholder="如: 192.168.1.1" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="macAddress"
              label="MAC 地址"
              rules={[
                {
                  pattern: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/,
                  message: 'MAC 地址格式不正确',
                },
              ]}
            >
              <Input placeholder="如: 00:1A:2B:3C:4D:5E" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="location"
          label="位置"
        >
          <Input placeholder="如: 机房A-1号机柜" />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, textAlign: 'right', marginTop: 24 }}>
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              {isEdit ? '保存' : '创建'}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default DeviceFormModal;
