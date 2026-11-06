const fs = require('fs');
const path = require('path');
const prisma = require('../config/prisma');
const { PrismaClient } = require('@prisma/client');
const { resolveDbPath, assertNotProduction, PROD_DB_PATH } = require('./testDatabaseGuard');

class BackupManager {
  constructor(customDbPath, customBackupDir) {
    this.customDbPath = customDbPath;
    this.customBackupDir = customBackupDir;
    this.maxBackups = 10;
    this.ensureBackupDir();
  }

  get dbPath() {
    if (this.customDbPath) return path.resolve(this.customDbPath);
    return resolveDbPath();
  }

  get backupDir() {
    if (this.customBackupDir) return path.resolve(this.customBackupDir);
    if (process.env.NODE_ENV === 'test') {
      return path.resolve(__dirname, '../../prisma/test_backups');
    }
    return path.resolve(__dirname, '../../prisma/backups');
  }

  ensureBackupDir() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  formatTimestamp() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = now.getFullYear();
    const MM = pad(now.getMonth() + 1);
    const dd = pad(now.getDate());
    const hh = pad(now.getHours());
    const mm = pad(now.getMinutes());
    const ss = pad(now.getSeconds());
    return `${yyyy}-${MM}-${dd}_${hh}-${mm}-${ss}`;
  }

  /**
   * Create an online, WAL-consistent SQLite backup using VACUUM INTO
   * @param {string} [label] - Optional tag (e.g., 'manual', 'pre_deploy')
   * @param {PrismaClient} [prismaClient] - Optional prisma client instance
   */
  async createBackup(label = 'manual', prismaClient = null) {
    this.ensureBackupDir();
    const timestamp = this.formatTimestamp();
    const filename = `viora_backup_${timestamp}_${label}.db`;
    const targetPath = path.join(this.backupDir, filename);

    // Normalize forward slashes for SQLite command
    const sqlitePath = targetPath.replace(/\\/g, '/');
    const client = prismaClient || prisma;

    try {
      console.log(`[BackupManager] Starting atomic backup to ${filename}...`);
      await client.$executeRawUnsafe(`VACUUM INTO '${sqlitePath}';`);

      // Verify backup integrity
      const isValid = await this.verifyBackup(targetPath);
      if (!isValid) {
        throw new Error('Integrity check failed for generated backup');
      }

      const stats = fs.statSync(targetPath);
      console.log(`[BackupManager] Backup created and verified successfully (${(stats.size / 1024).toFixed(1)} KB)`);

      // Prune old backups to respect retention policy
      this.pruneOldBackups();

      return {
        success: true,
        filename,
        path: targetPath,
        sizeBytes: stats.size,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      console.error('[BackupManager] Backup creation failed:', err.message);
      // Clean up incomplete/corrupted file if any
      if (fs.existsSync(targetPath)) {
        try { fs.unlinkSync(targetPath); } catch {}
      }
      throw err;
    }
  }

  /**
   * Verify backup database integrity
   */
  async verifyBackup(backupFilePath) {
    let resolvedPath = backupFilePath;
    if (!path.isAbsolute(resolvedPath)) {
      resolvedPath = path.join(this.backupDir, backupFilePath);
    }

    if (!fs.existsSync(resolvedPath)) {
      console.warn(`[BackupManager] Backup file not found: ${resolvedPath}`);
      return false;
    }

    let testClient = null;
    try {
      const normalizedPath = resolvedPath.replace(/\\/g, '/');
      testClient = new PrismaClient({
        datasources: {
          db: { url: `file:${normalizedPath}` }
        }
      });
      const result = await testClient.$queryRawUnsafe('PRAGMA integrity_check;');
      await testClient.$disconnect();
      return Array.isArray(result) && result[0] && result[0].integrity_check === 'ok';
    } catch (err) {
      console.error('[BackupManager] Integrity verification failed:', err.message);
      if (testClient) {
        try { await testClient.$disconnect(); } catch {}
      }
      return false;
    }
  }

  /**
   * List all available backups
   */
  listBackups() {
    this.ensureBackupDir();
    const files = fs.readdirSync(this.backupDir)
      .filter(f => f.endsWith('.db'))
      .map(filename => {
        const fullPath = path.join(this.backupDir, filename);
        const stats = fs.statSync(fullPath);
        return {
          filename,
          path: fullPath,
          sizeBytes: stats.size,
          sizeKb: (stats.size / 1024).toFixed(1),
          createdAt: stats.birthtime || stats.mtime
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);

    return files;
  }

  /**
   * Prune backups older than maxBackups
   */
  pruneOldBackups() {
    try {
      const backups = this.listBackups();
      if (backups.length > this.maxBackups) {
        const toDelete = backups.slice(this.maxBackups);
        for (const file of toDelete) {
          try {
            fs.unlinkSync(file.path);
            console.log(`[BackupManager] Pruned older backup: ${file.filename}`);
          } catch {}
        }
      }
    } catch (err) {
      console.warn('[BackupManager] Failed to prune old backups:', err.message);
    }
  }

  /**
   * Restore database from backup file
   * @param {string} backupFilenameOrPath
   * @param {object} [options]
   * @param {string} [options.targetDbPath] - Explicit target path
   * @param {PrismaClient} [options.prismaClient] - Existing prisma client to disconnect
   */
  async restoreBackup(backupFilenameOrPath, options = {}) {
    let resolvedBackup = backupFilenameOrPath;
    if (!path.isAbsolute(resolvedBackup)) {
      resolvedBackup = path.join(this.backupDir, backupFilenameOrPath);
    }

    if (!fs.existsSync(resolvedBackup)) {
      throw new Error(`Backup file does not exist: ${resolvedBackup}`);
    }

    const destinationDb = options.targetDbPath ? path.resolve(options.targetDbPath) : this.dbPath;

    // Critical Safety Check: Never restore against production if in test environment
    if (process.env.NODE_ENV === 'test') {
      assertNotProduction(destinationDb);
    }

    // Verify backup integrity prior to restore
    const isOk = await this.verifyBackup(resolvedBackup);
    if (!isOk) {
      throw new Error('Integrity check failed: Selected backup is corrupted or invalid.');
    }

    const client = options.prismaClient || prisma;
    console.log(`[BackupManager] Safety checkpoint: creating pre-restore backup...`);
    const preRestoreBackup = path.join(this.backupDir, `viora_prerestore_${Date.now()}.db`);
    try {
      await client.$executeRawUnsafe(`VACUUM INTO '${preRestoreBackup.replace(/\\/g, '/')}';`);
    } catch (err) {
      // If client cannot vacuum (e.g. fresh empty target), create file copy if target exists
      if (fs.existsSync(destinationDb)) {
        try { fs.copyFileSync(destinationDb, preRestoreBackup); } catch {}
      }
    }

    // Disconnect active prisma clients
    try {
      await client.$disconnect();
    } catch {}

    // Remove existing destination WAL and SHM files before copy
    const walPath = `${destinationDb}-wal`;
    const shmPath = `${destinationDb}-shm`;
    if (fs.existsSync(walPath)) try { fs.unlinkSync(walPath); } catch {}
    if (fs.existsSync(shmPath)) try { fs.unlinkSync(shmPath); } catch {}

    // Copy backup over destination
    fs.copyFileSync(resolvedBackup, destinationDb);

    // Verify restored database integrity
    const restoredOk = await this.verifyBackup(destinationDb);
    if (!restoredOk) {
      throw new Error('Integrity check failed on restored database file');
    }

    console.log(`[BackupManager] Database restored and verified successfully from ${path.basename(resolvedBackup)}`);
    return { success: true, restoredFrom: path.basename(resolvedBackup), targetPath: destinationDb };
  }
}

const defaultManager = new BackupManager();
defaultManager.BackupManager = BackupManager;
module.exports = defaultManager;
