/**
 * SSH客户端工具模块
 * 用于连接网络设备执行命令和获取配置
 */

import { Client } from 'ssh2';

export interface SSHCredentials {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
}

export interface SSHResult {
  success: boolean;
  output?: string;
  error?: string;
}

/**
 * SSH客户端类
 */
export class SSHClient {
  private client: Client;
  private credentials: SSHCredentials;
  private connected: boolean = false;

  constructor(credentials: SSHCredentials) {
    this.client = new Client();
    this.credentials = {
      ...credentials,
      port: credentials.port || 22,
    };
  }

  /**
   * 连接到设备
   */
  async connect(): Promise<SSHResult> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.client.end();
        resolve({ success: false, error: '连接超时' });
      }, 30000);

      this.client.on('ready', () => {
        clearTimeout(timeout);
        this.connected = true;
        resolve({ success: true });
      });

      this.client.on('error', (err) => {
        clearTimeout(timeout);
        resolve({ success: false, error: err.message });
      });

      this.client.connect({
        host: this.credentials.host,
        port: this.credentials.port,
        username: this.credentials.username,
        password: this.credentials.password,
        privateKey: this.credentials.privateKey,
        readyTimeout: 30000,
        algorithms: {
          kex: [
            'ecdh-sha2-nistp256',
            'ecdh-sha2-nistp384',
            'ecdh-sha2-nistp521',
            'diffie-hellman-group-exchange-sha256',
            'diffie-hellman-group14-sha256',
            'diffie-hellman-group14-sha1',
          ],
        },
      });
    });
  }

  /**
   * 执行命令
   */
  async executeCommand(command: string): Promise<SSHResult> {
    if (!this.connected) {
      return { success: false, error: '未连接到设备' };
    }

    return new Promise((resolve) => {
      let output = '';
      let errorOutput = '';

      this.client.exec(command, { pty: true }, (err, stream) => {
        if (err) {
          resolve({ success: false, error: err.message });
          return;
        }

        stream.on('data', (data: Buffer) => {
          output += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });

        stream.on('close', () => {
          if (errorOutput) {
            resolve({ success: false, output, error: errorOutput });
          } else {
            resolve({ success: true, output });
          }
        });
      });
    });
  }

  /**
   * 获取设备running-config
   */
  async getRunningConfig(): Promise<SSHResult> {
    // 尝试不同厂商的命令
    const commands = [
      'show running-config',        // Cisco IOS
      'display current-configuration', // Huawei/H3C
      'show configuration running',    // Juniper
    ];

    for (const cmd of commands) {
      const result = await this.executeCommand(cmd);
      if (result.success && result.output && result.output.length > 100) {
        return result;
      }
    }

    return { success: false, error: '无法获取设备配置' };
  }

  /**
   * 下发配置命令
   */
  async deployConfig(commands: string[]): Promise<SSHResult> {
    const results: string[] = [];
    
    for (const cmd of commands) {
      const result = await this.executeCommand(cmd);
      if (!result.success) {
        return {
          success: false,
          output: results.join('\n'),
          error: `命令执行失败: ${cmd} - ${result.error}`,
        };
      }
      results.push(result.output || '');
    }

    return { success: true, output: results.join('\n') };
  }

  /**
   * 进入配置模式并下发配置
   */
  async configureDevice(configLines: string[]): Promise<SSHResult> {
    // 进入配置模式
    const enterConfig = await this.executeCommand('configure terminal');
    if (!enterConfig.success) {
      // 尝试华为/H3C命令
      const huaweiConfig = await this.executeCommand('system-view');
      if (!huaweiConfig.success) {
        return { success: false, error: '无法进入配置模式' };
      }
    }

    // 执行配置命令
    const result = await this.deployConfig(configLines);

    // 退出配置模式
    await this.executeCommand('end');
    await this.executeCommand('quit');

    return result;
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.connected) {
      this.client.end();
      this.connected = false;
    }
  }
}

/**
 * 快捷函数：执行单个命令
 */
export async function executeSSHCommand(
  credentials: SSHCredentials,
  command: string
): Promise<SSHResult> {
  const client = new SSHClient(credentials);
  
  const connectResult = await client.connect();
  if (!connectResult.success) {
    return connectResult;
  }

  const result = await client.executeCommand(command);
  client.disconnect();
  
  return result;
}

/**
 * 快捷函数：获取设备配置
 */
export async function getDeviceConfig(
  credentials: SSHCredentials
): Promise<SSHResult> {
  const client = new SSHClient(credentials);
  
  const connectResult = await client.connect();
  if (!connectResult.success) {
    return connectResult;
  }

  const result = await client.getRunningConfig();
  client.disconnect();
  
  return result;
}
