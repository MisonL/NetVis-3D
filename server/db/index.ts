import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// 数据库连接配置
const connectionString = process.env.DATABASE_URL || 'postgres://netvis:netvis123@localhost:5432/netvis';

// 创建postgres连接
const client = postgres(connectionString);

// 创建drizzle实例
export const db = drizzle(client, { schema });

// 健康检查
export async function checkDbConnection(): Promise<boolean> {
  try {
    await client`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection error:', error);
    return false;
  }
}

export { schema };
