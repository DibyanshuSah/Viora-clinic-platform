const backupManager = require('./backupManager');

async function main() {
  const [,, command, arg] = process.argv;

  switch (command) {
    case 'create': {
      const label = arg || 'manual';
      const result = await backupManager.createBackup(label);
      console.log(`\n✔ Backup created successfully: ${result.filename}`);
      console.log(`  Path: ${result.path}`);
      console.log(`  Size: ${(result.sizeBytes / 1024).toFixed(1)} KB\n`);
      break;
    }
    case 'list': {
      const list = backupManager.listBackups();
      console.log(`\nAvailable Backups (${list.length}):`);
      list.forEach((b, i) => {
        console.log(`  [${i + 1}] ${b.filename} (${b.sizeKb} KB) - ${b.createdAt.toISOString()}`);
      });
      console.log();
      break;
    }
    case 'verify': {
      if (!arg) {
        console.error('Usage: node backupCli.js verify <filename>');
        process.exit(1);
      }
      const ok = await backupManager.verifyBackup(arg);
      if (ok) {
        console.log(`✔ Backup integrity verified OK: ${arg}`);
      } else {
        console.error(`❌ Backup verification failed: ${arg}`);
        process.exit(1);
      }
      break;
    }
    case 'restore': {
      if (!arg) {
        console.error('Usage: node backupCli.js restore <filename>');
        process.exit(1);
      }
      console.log(`WARNING: This will overwrite your active database with ${arg}.`);
      const result = await backupManager.restoreBackup(arg);
      console.log(`✔ ${result.restoredFrom} restored successfully.`);
      break;
    }
    default:
      console.log('VIORA SQLite Database Backup Utility');
      console.log('Commands:');
      console.log('  node backupCli.js create [label]   Create a new consistent backup');
      console.log('  node backupCli.js list             List all available backups');
      console.log('  node backupCli.js verify <file>    Verify backup integrity');
      console.log('  node backupCli.js restore <file>   Restore database from backup');
  }
}

main()
  .catch(err => {
    console.error('Backup CLI Error:', err.message);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
