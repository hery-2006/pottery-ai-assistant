// DeepSeek AI 代理服务器 — 零依赖，Node 内置 http 模块
var http = require('http');
var https = require('https');
var fs = require('fs');
var path = require('path');

// 读取 API Key（从 .env 文件）
var API_KEY = '';
try {
  var env = fs.readFileSync('.env', 'utf8');
  var m = env.match(/DEEPSEEK_KEY\s*=\s*(.+)/);
  if (m) API_KEY = m[1].trim();
} catch(e) {
  console.log('⚠️  .env 文件不存在，请创建 .env 文件并写入: DEEPSEEK_KEY=sk-xxx');
}

var PORT = 3456;
var DEEPSEEK_URL = 'api.deepseek.com';
var DEEPSEEK_PATH = '/v1/chat/completions';

// MIME types
var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function getMIME(ext) { return MIME[ext] || 'application/octet-stream'; }

var server = http.createServer(function(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  var url = req.url.split('?')[0];

  // ============ API 代理 ============
  if (url === '/api/chat' && req.method === 'POST' && API_KEY) {
    var body = '';
    req.on('data', function(chunk) { body += chunk; });
    req.on('end', function() {
      try {
        var payload = JSON.parse(body);
        var options = {
          hostname: DEEPSEEK_URL,
          path: DEEPSEEK_PATH,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + API_KEY
          },
          timeout: 30000
        };

        var proxy = https.request(options, function(proxyRes) {
          var data = '';
          proxyRes.on('data', function(chunk) { data += chunk; });
          proxyRes.on('end', function() {
            res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(data);
          });
        });

        proxy.on('error', function(err) {
          console.log('❌ DeepSeek 代理失败:', err.message);
          res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'AI 服务暂时不可用，请稍后重试。' }));
        });

        proxy.on('timeout', function() {
          proxy.destroy();
          res.writeHead(504, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'AI 服务响应超时，请稍后重试。' }));
        });

        proxy.write(JSON.stringify(payload));
        proxy.end();
      } catch(e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: '请求格式错误。' }));
      }
    });
    return;
  }

  // ============ 静态文件 ============
  if (url === '/') url = '/index.html';
  var filePath = path.join(__dirname, url);

  // 安全检查
  if (!filePath.startsWith(__dirname)) { res.writeHead(403); res.end(); return; }

  fs.readFile(filePath, function(err, data) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    var ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': getMIME(ext) });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', function() {
  console.log('🏺 陶艺AI服务已启动');
  console.log('   地址: http://localhost:' + PORT);
  console.log('   界面: http://localhost:' + PORT + '/index.html');
  console.log('   指导: http://localhost:' + PORT + '/guide.html');
  console.log('   DeepSeek: ' + (API_KEY ? '✅ 已连接' : '⚠️  未配置API Key'));
});
