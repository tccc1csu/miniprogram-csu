import {execFileSync} from 'node:child_process';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const envPath = path.join(root, '.env');

const slotIndex = process.argv.indexOf('--slot');
const slot = slotIndex > -1 ? process.argv[slotIndex + 1] : 'direct';
if (!['direct', 'pool'].includes(slot)) {
  console.error('--slot 只能是 direct 或 pool');
  process.exit(1);
}
const key = slot === 'pool' ? 'DATABASE_URL_POOL' : 'DATABASE_URL';

let clipboard = '';
try {
  clipboard = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Get-Clipboard -Raw'], {
    encoding: 'utf8',
    windowsHide: true,
  }).trim();
} catch (error) {
  console.error('读取剪贴板失败：' + error.message);
  process.exit(1);
}

const match = clipboard.match(/postgres(?:ql)?:\/\/[^\s"'<>]+/);
if (!match) {
  console.error('剪贴板里没有 postgresql:// 开头的连接串。');
  console.error('  请在控制台点「复制连接串」，或完整选中形如 postgresql://user:pass@host:5432/db 的那一行再复制。');
  process.exit(1);
}

const url = match[0];
let parsed;
try {
  parsed = new URL(url);
  if (!['postgresql:', 'postgres:'].includes(parsed.protocol)) throw new Error('协议不对');
  if (!parsed.hostname) throw new Error('缺少主机名');
} catch (error) {
  console.error('剪贴板里的内容不是合法连接串：' + error.message);
  process.exit(1);
}

const masked = new URL(url);
if (masked.password) masked.password = '***';

let text = await readFile(envPath, 'utf8');
const line = new RegExp('^' + key + '=.*$', 'm');
text = line.test(text) ? text.replace(line, key + '=' + url) : text.trimEnd() + '\n' + key + '=' + url + '\n';
await writeFile(envPath, text, 'utf8');

console.log('已写入 .env 的 ' + key);
console.log('  主机：' + parsed.hostname + ':' + (parsed.port || '5432'));
console.log('  库名：' + parsed.pathname.replace(/^\//, '') || '(默认)');
console.log('  账号：' + decodeURIComponent(parsed.username));
console.log('  密码：已写入，不回显');
console.log('  完整串：' + masked.toString());
console.log('\n下一步：npm run db:check');
