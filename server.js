// 陶艺AI 代理服务器 — 支持多 AI 后端 (DeepSeek + Vision)
var http = require('http');
var https = require('https');
var fs = require('fs');
var path = require('path');
var url = require('url');

// ============ 读取配置 ============
var CONFIG = {
  port: 3456,
  // DeepSeek 文字模型 (默认走火山引擎 Ark)
  deepseek: { key: '', url: 'ark.cn-beijing.volces.com', path: '/api/v3/chat/completions', model: 'deepseek-v3-250324' },
  // Vision 视觉模型 (可配置)
  vision: { key: '', url: 'api.xiaomimimo.com', path: '/v1/chat/completions', model: 'xiaomi-mimo-vision' }
};

try {
  var envContent = fs.readFileSync('.env', 'utf8');
  var lines = envContent.split('\n');
  lines.forEach(function(line) {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    var eqIdx = line.indexOf('=');
    if (eqIdx === -1) return;
    var key = line.substring(0, eqIdx).trim();
    var val = line.substring(eqIdx + 1).trim();
    if (key === 'DEEPSEEK_KEY') CONFIG.deepseek.key = val;
    if (key === 'DEEPSEEK_URL') {
      var u = val.replace(/^https?:\/\//, '');
      var slashIdx = u.indexOf('/');
      if (slashIdx > 0) { CONFIG.deepseek.url = u.substring(0, slashIdx); CONFIG.deepseek.path = u.substring(slashIdx); }
      else CONFIG.deepseek.url = u;
    }
    if (key === 'DEEPSEEK_PATH') CONFIG.deepseek.path = val;
    if (key === 'DEEPSEEK_MODEL') CONFIG.deepseek.model = val;
    if (key === 'VISION_API_KEY') CONFIG.vision.key = val;
    if (key === 'VISION_API_URL') {
      var u = val.replace(/^https?:\/\//, '');
      var slashIdx = u.indexOf('/');
      if (slashIdx > 0) { CONFIG.vision.url = u.substring(0, slashIdx); CONFIG.vision.path = u.substring(slashIdx); }
      else CONFIG.vision.url = u;
    }
    if (key === 'VISION_MODEL') CONFIG.vision.model = val;
    if (key === 'PORT') CONFIG.port = parseInt(val) || 3456;
  });
} catch(e) {
  console.log('⚠️  .env 文件读取失败，使用默认配置');
}

// ============ MIME types ============
var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};

function getMIME(ext) { return MIME[ext] || 'application/octet-stream'; }

// ============ 数据目录初始化 ============
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) { fs.mkdirSync(dirPath, { recursive: true }); }
}

function readJSON(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch(e) { return fallback !== undefined ? fallback : null; }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// ============ 数据迁移：旧 teacher-data.json → 新结构 ============
function migrateOldData() {
  var dataDir = path.join(__dirname, 'data');
  var oldPath = path.join(__dirname, 'teacher-data.json');
  if (!fs.existsSync(oldPath)) return;

  console.log('🔄 检测到旧数据文件 teacher-data.json，正在迁移…');
  ensureDir(dataDir);
  ensureDir(path.join(dataDir, 'teacher_logs'));
  ensureDir(path.join(dataDir, 'chat_history'));

  var oldData = readJSON(oldPath, []);
  if (!Array.isArray(oldData) || oldData.length === 0) {
    fs.renameSync(oldPath, oldPath + '.bak');
    console.log('  旧数据文件为空，已归档');
    return;
  }

  var usersPath = path.join(dataDir, 'users.json');
  var users = readJSON(usersPath, {});
  var defaultTeacherId = 'T001';
  var teacherLogsPath = path.join(dataDir, 'teacher_logs', defaultTeacherId + '.json');

  // 确保默认教师存在
  if (!users[defaultTeacherId]) {
    users[defaultTeacherId] = { id: defaultTeacherId, name: '默认教师', role: 'teacher', createdAt: new Date().toISOString() };
  }

  // 加载已有教师日志（可能之前迁移过）
  var teacherLogs = readJSON(teacherLogsPath, []);

  oldData.forEach(function(entry) {
    var sName = entry.student || '匿名学生';
    var sid = 'S_' + encodeURIComponent(sName);
    if (!users[sid]) {
      users[sid] = { id: sid, name: sName, role: 'student', teacherId: defaultTeacherId, createdAt: entry.timestamp || new Date().toISOString() };
    }
    teacherLogs.push({
      studentId: sid, studentName: sName,
      question: entry.question, step: entry.step || '', stepIndex: entry.stepIndex,
      role: entry.role || 'student', timestamp: entry.timestamp || new Date().toISOString()
    });
  });

  writeJSON(usersPath, users);
  writeJSON(teacherLogsPath, teacherLogs);
  fs.renameSync(oldPath, oldPath + '.bak');
  console.log('✅ 迁移完成：' + teacherLogs.length + ' 条 → data/teacher_logs/' + defaultTeacherId + '.json');
  console.log('  ' + Object.keys(users).length + ' 个用户 → data/users.json');
}

// ============ 通用 AI 请求函数 ============
function aiRequest(apiConfig, payload, callback) {
  var body = JSON.stringify(payload);
  var options = {
    hostname: apiConfig.url,
    path: apiConfig.path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiConfig.key,
      'Content-Length': Buffer.byteLength(body)
    },
    timeout: 60000
  };

  var proxy = https.request(options, function(proxyRes) {
    var data = '';
    proxyRes.on('data', function(chunk) { data += chunk; });
    proxyRes.on('end', function() {
      try {
        callback(null, proxyRes.statusCode, JSON.parse(data));
      } catch(e) {
        callback(null, proxyRes.statusCode, data);
      }
    });
  });

  proxy.on('error', function(err) {
    callback(err, 502, null);
  });

  proxy.on('timeout', function() {
    proxy.destroy();
    callback(new Error('timeout'), 504, null);
  });

  proxy.write(body);
  proxy.end();
}

// ============ 主服务器 ============
var server = http.createServer(function(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  var parsedUrl = url.parse(req.url, true);
  var pathname = parsedUrl.pathname;
  var query = parsedUrl.query;

  // ============ API: 文字问答 (DeepSeek) ============
  if (pathname === '/api/chat' && req.method === 'POST') {
    if (!CONFIG.deepseek.key) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'DeepSeek API Key 未配置，请在 .env 文件中设置 DEEPSEEK_KEY' }));
      return;
    }
    handleStreamBody(req, function(payload) {
      // 确保使用配置的模型
      if (!payload.model) payload.model = CONFIG.deepseek.model;
      aiRequest(CONFIG.deepseek, payload, function(err, status, data) {
        if (err) {
          res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'AI 服务暂时不可用: ' + err.message }));
        } else {
          res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(typeof data === 'string' ? data : JSON.stringify(data));
        }
      });
    });
    return;
  }

  // ============ API: 视觉问答 (Vision Model) ============
  if (pathname === '/api/vision' && req.method === 'POST') {
    if (!CONFIG.vision.key) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Vision API Key 未配置，请在 .env 文件中设置 VISION_API_KEY' }));
      return;
    }
    handleStreamBody(req, function(payload) {
      if (!payload.model) payload.model = CONFIG.vision.model;
      aiRequest(CONFIG.vision, payload, function(err, status, data) {
        if (err) {
          res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Vision AI 服务暂时不可用: ' + err.message }));
        } else {
          res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(typeof data === 'string' ? data : JSON.stringify(data));
        }
      });
    });
    return;
  }

  // ============ API: 用户认证（注册/登录）============
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    handleStreamBody(req, function(payload) {
      var id = (payload.id || '').trim();
      var name = (payload.name || '').trim();
      var role = payload.role || 'student';
      var teacherId = (payload.teacherId || '').trim();

      if (!id) { res.writeHead(400, ctJson); res.end(jsonErr('缺少 id')); return; }
      if (!name) { res.writeHead(400, ctJson); res.end(jsonErr('缺少 name')); return; }
      if (role === 'student' && !teacherId) { res.writeHead(400, ctJson); res.end(jsonErr('学生必须指定教师工号')); return; }

      var dataDir = path.join(__dirname, 'data');
      ensureDir(dataDir);
      ensureDir(path.join(dataDir, 'chat_history'));
      ensureDir(path.join(dataDir, 'teacher_logs'));
      var usersPath = path.join(dataDir, 'users.json');
      var users = readJSON(usersPath, {});

      var now = new Date().toISOString();

      if (users[id]) {
        // 已存在，允许更新姓名（但不改 ID）
        var existing = users[id];
        if (name && name !== existing.name) { existing.name = name; }
        if (role === 'student' && teacherId && !existing.teacherId) {
          existing.teacherId = teacherId;
        }
        // 确保教师存在
        if (teacherId && !users[teacherId]) {
          users[teacherId] = { id: teacherId, name: '教师' + teacherId, role: 'teacher', createdAt: now };
        }
        writeJSON(usersPath, users);
        res.writeHead(200, ctJson);
        res.end(JSON.stringify({ ok: true, user: existing }));
        return;
      }

      // 新用户注册
      var user = { id: id, name: name, role: role, createdAt: now };
      if (teacherId) { user.teacherId = teacherId; }
      users[id] = user;

      // 教师工号自动创建
      if (teacherId && !users[teacherId]) {
        users[teacherId] = { id: teacherId, name: '教师' + teacherId, role: 'teacher', createdAt: now };
      }

      writeJSON(usersPath, users);
      console.log('👤 新用户注册: ' + id + ' (' + name + ', ' + role + ')');
      res.writeHead(200, ctJson);
      res.end(JSON.stringify({ ok: true, user: user }));
    });
    return;
  }

  // ============ API: 获取用户信息 ============
  if (pathname === '/api/auth/user' && req.method === 'GET') {
    var uid = query.id || '';
    var users = readJSON(path.join(__dirname, 'data', 'users.json'), {});
    var user = users[uid];
    if (user) {
      res.writeHead(200, ctJson);
      res.end(JSON.stringify({ ok: true, user: user }));
    } else {
      res.writeHead(404, ctJson);
      res.end(JSON.stringify({ ok: false, error: '用户不存在' }));
    }
    return;
  }

  // ============ API: 教师列表（供学生选老师）============
  if (pathname === '/api/teacher/list' && req.method === 'GET') {
    var users = readJSON(path.join(__dirname, 'data', 'users.json'), {});
    var teachers = [];
    Object.keys(users).forEach(function(k) {
      if (users[k].role === 'teacher') teachers.push({ id: users[k].id, name: users[k].name });
    });
    res.writeHead(200, ctJson);
    res.end(JSON.stringify({ ok: true, teachers: teachers }));
    return;
  }

  // ============ API: 教师查看自己学生列表 ============
  if (pathname === '/api/teacher/students' && req.method === 'GET') {
    var tid = query.teacherId || '';
    if (!tid) { res.writeHead(400, ctJson); res.end(jsonErr('缺少 teacherId')); return; }
    var users = readJSON(path.join(__dirname, 'data', 'users.json'), {});
    var students = [];
    Object.keys(users).forEach(function(k) {
      var u = users[k];
      if (u.role === 'student' && u.teacherId === tid) students.push({ id: u.id, name: u.name, createdAt: u.createdAt });
    });
    students.sort(function(a, b) { return (a.createdAt || '').localeCompare(b.createdAt || ''); });
    res.writeHead(200, ctJson);
    res.end(JSON.stringify({ ok: true, students: students }));
    return;
  }

  // ============ API: 聊天记录（服务端存储）============
  if (pathname === '/api/chat/history' && req.method === 'POST') {
    handleStreamBody(req, function(payload) {
      var userId = payload.userId || '';
      var action = payload.action || 'load';
      if (!userId) { res.writeHead(400, ctJson); res.end(jsonErr('缺少 userId')); return; }

      var chatDir = path.join(__dirname, 'data', 'chat_history');
      ensureDir(chatDir);
      var chatFile = path.join(chatDir, userId.replace(/[\/\\:*?"<>|]/g, '_') + '.json');

      if (action === 'save') {
        var history = payload.history || [];
        if (history.length > 100) history = history.slice(-100); // 最多保留100条
        writeJSON(chatFile, history);
        res.writeHead(200, ctJson);
        res.end(JSON.stringify({ ok: true }));
      } else if (action === 'clear') {
        writeJSON(chatFile, []);
        res.writeHead(200, ctJson);
        res.end(JSON.stringify({ ok: true }));
      } else {
        // load
        var history = readJSON(chatFile, []);
        res.writeHead(200, ctJson);
        res.end(JSON.stringify({ ok: true, history: history }));
      }
    });
    return;
  }

  // ============ API: TTS 语音合成 (Edge 神经语音) ============
  if (pathname === '/api/tts' && req.method === 'POST') {
    handleStreamBody(req, function(payload) {
      var text = payload.text || '';
      var voice = payload.voice || 'zh-CN-XiaoxiaoNeural';
      var rate = payload.rate || '+0%';
      var pitch = payload.pitch || '+0Hz';
      if (!text) { res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ error: '缺少 text 参数' })); return; }
      edgeTTS(text, voice, rate, pitch, function(err, audioData, contentType) {
        if (err) {
          console.log('TTS 失败:', err.message);
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'TTS 服务失败: ' + err.message }));
        } else {
          res.writeHead(200, { 'Content-Type': contentType || 'audio/mpeg', 'Content-Length': audioData.length, 'Cache-Control': 'public, max-age=3600' });
          res.end(audioData);
        }
      });
    });
    return;
  }

  // ============ API: 教师面板 — 记录问题 ============
  if (pathname === '/api/teacher/log' && req.method === 'POST') {
    handleStreamBody(req, function(payload) {
      var entry = {
        studentId: payload.studentId || '',
        studentName: payload.studentName || payload.student || '匿名学生',
        question: payload.question || '',
        step: payload.step || '',
        stepIndex: payload.stepIndex,
        role: payload.role || 'student',
        timestamp: new Date().toISOString()
      };
      var teacherId = (payload.teacherId || '').trim();
      if (!teacherId) {
        // 无教师ID时记录错误并跳过
        console.log('⚠️  收到无 teacherId 的日志请求，已跳过: ' + (entry.studentName || '未知学生'));
        res.writeHead(400, ctJson);
        res.end(JSON.stringify({ error: '缺少 teacherId' }));
        return;
      }

      // 新存储路径：按教师分文件
      var logsDir = path.join(__dirname, 'data', 'teacher_logs');
      ensureDir(logsDir);
      var logFile = path.join(logsDir, teacherId.replace(/[\/\\:*?"<>|]/g, '_') + '.json');
      var data = readJSON(logFile, []);
      data.push(entry);
      writeJSON(logFile, data);

      // 同时保持旧文件兼容（教师面板可能仍读旧路径）
      var oldFile = path.join(__dirname, 'teacher-data.json');
      try {
        var oldData = JSON.parse(fs.readFileSync(oldFile, 'utf8'));
        oldData.push(entry);
        fs.writeFileSync(oldFile, JSON.stringify(oldData, null, 2), 'utf8');
      } catch(e) {}

      res.writeHead(200, ctJson);
      res.end(JSON.stringify({ ok: true, total: data.length }));
    });
    return;
  }

  // ============ API: 教师面板 — 获取统计 ============
  if (pathname === '/api/teacher/stats' && req.method === 'GET') {
    var teacherId = query.teacherId || '';
    var data;

    if (teacherId) {
      // 按教师ID读取专属日志
      var logFile = path.join(__dirname, 'data', 'teacher_logs', teacherId.replace(/[\/\\:*?"<>|]/g, '_') + '.json');
      data = readJSON(logFile, []);
    } else {
      // 合并所有教师日志
      data = [];
      var logsDir = path.join(__dirname, 'data', 'teacher_logs');
      try {
        var files = fs.readdirSync(logsDir);
        files.forEach(function(f) {
          if (f.endsWith('.json')) {
            var d = readJSON(path.join(logsDir, f), []);
            if (Array.isArray(d)) data = data.concat(d);
          }
        });
      } catch(e) {}
    }
    // 统计分析
    var questionCount = {};
    var stepCount = {};
    var studentCount = {};
    var recentQuestions = [];
    data.forEach(function(item) {
      var key = item.question.length > 20 ? item.question.substring(0, 20) : item.question;
      questionCount[key] = (questionCount[key] || 0) + 1;
      if (item.step) stepCount[item.step] = (stepCount[item.step] || 0) + 1;
      var sName = item.studentName || item.student || '匿名';
      if (sName) studentCount[sName] = (studentCount[sName] || 0) + 1;
    });
    // 最近20条
    recentQuestions = data.slice(-20).reverse();
    // 热门问题排序
    var hotQuestions = Object.entries(questionCount)
      .sort(function(a, b) { return b[1] - a[1]; })
      .slice(0, 10)
      .map(function(e) { return { question: e[0], count: e[1] }; });
    // 步骤热度
    var hotSteps = Object.entries(stepCount)
      .sort(function(a, b) { return b[1] - a[1]; })
      .map(function(e) { return { step: e[0], count: e[1] }; });
    // 活跃学生
    var activeStudents = Object.entries(studentCount)
      .sort(function(a, b) { return b[1] - a[1]; })
      .map(function(e) { return { name: e[0], count: e[1] }; });

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      totalQuestions: data.length,
      uniqueStudents: Object.keys(studentCount).length,
      hotQuestions: hotQuestions,
      hotSteps: hotSteps,
      activeStudents: activeStudents,
      recentQuestions: recentQuestions,
      allData: data
    }));
    return;
  }

  // ============ API: 教师面板 — 清空数据 ============
  if (pathname === '/api/teacher/clear' && req.method === 'POST') {
    handleStreamBody(req, function(payload) {
      var teacherId = payload.teacherId || '';
      if (teacherId) {
        var logFile = path.join(__dirname, 'data', 'teacher_logs', teacherId.replace(/[\/\\:*?"<>|]/g, '_') + '.json');
        writeJSON(logFile, []);
      } else {
        // 旧方式兼容
        var oldFile = path.join(__dirname, 'teacher-data.json');
        writeJSON(oldFile, []);
      }
      res.writeHead(200, ctJson);
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  // ============ API: 获取配置状态 ============
  if (pathname === '/api/config' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      deepseek: { configured: !!CONFIG.deepseek.key, model: CONFIG.deepseek.model },
      vision: { configured: !!CONFIG.vision.key, model: CONFIG.vision.model }
    }));
    return;
  }

  // ============ 静态文件服务 ============
  if (pathname === '/') pathname = '/login.html';
  var filePath = path.join(__dirname, pathname);

  // 安全检查：防止目录遍历
  var resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(__dirname))) {
    res.writeHead(403);
    res.end('403 Forbidden');
    return;
  }

  var ext = path.extname(filePath).toLowerCase();
  var mime = getMIME(ext);
  var isVideo = /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(ext);

  if (isVideo) {
    serveVideo(filePath, req, res, mime);
    return;
  }

  fs.readFile(filePath, function(err, data) {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 Internal Server Error');
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

// ============ 辅助函数 ============
var ctJson = { 'Content-Type': 'application/json; charset=utf-8' };
function jsonErr(msg) { return JSON.stringify({ error: msg }); }

function handleStreamBody(req, callback) {
  var body = '';
  req.on('data', function(chunk) { body += chunk; });
  req.on('end', function() {
    try {
      callback(JSON.parse(body));
    } catch(e) {
      callback({});
    }
  });
}

function serveVideo(filePath, req, res, mime) {
  fs.stat(filePath, function(err, stats) {
    if (err) { res.writeHead(404); res.end('404 Not Found'); return; }

    var fileSize = stats.size;
    var range = req.headers.range;

    if (range) {
      var parts = range.replace(/bytes=/, '').split('-');
      var start = parseInt(parts[0], 10);
      var end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      var chunkSize = end - start + 1;

      if (start >= fileSize) {
        res.writeHead(416, { 'Content-Range': 'bytes */' + fileSize });
        res.end();
        return;
      }
      if (end >= fileSize) end = fileSize - 1;

      var stream = fs.createReadStream(filePath, { start: start, end: end });
      res.writeHead(206, {
        'Content-Range': 'bytes ' + start + '-' + end + '/' + fileSize,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mime
      });
      stream.pipe(res);
      stream.on('error', function() { res.end(); });
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': mime,
        'Accept-Ranges': 'bytes'
      });
      var stream = fs.createReadStream(filePath);
      stream.pipe(res);
      stream.on('error', function() { res.end(); });
    }
  });
}

// ============ Edge TTS (通过 Python edge-tts，微软神经语音) ============
var _ttsBusy = false;

function edgeTTS(text, voice, rate, pitch, callback) {
  // 防止并发调用导致子进程混乱
  if (_ttsBusy) { callback(new Error('TTS busy')); return; }
  _ttsBusy = true;

  // 用句号断句，避免单次合成太长导致超时
  var sentences = text.split(/[。！？\n]/).filter(function(s) { return s.trim().length > 0; });
  if (sentences.length === 0) sentences = [text];

  // 取前3句（避免太长）
  var shortText = sentences.slice(0, 3).join('。') + '。';
  if (shortText.length > 300) shortText = shortText.slice(0, 300);

  // 用临时文件避免 shell 编码问题
  var tmpDir = require('os').tmpdir();
  var tmpIn = tmpDir + '/tts_in_' + Date.now() + '.txt';
  var tmpOut = tmpDir + '/tts_out_' + Date.now() + '.mp3';

  fs.writeFile(tmpIn, shortText, 'utf8', function(err) {
    if (err) { _ttsBusy = false; callback(err); return; }

    var spawn = require('child_process').spawn;
    var child = spawn('edge-tts', [
      '--voice', voice || 'zh-CN-XiaoxiaoNeural',
      '--rate', rate || '-5%',
      '--file', tmpIn,
      '--write-media', tmpOut
    ], { timeout: 15000 });

    var stderr = '';
    child.stderr.on('data', function(d) { stderr += d.toString(); });

    child.on('close', function(code) {
      if (code === 0) {
        fs.readFile(tmpOut, function(err2, audio) {
          _ttsBusy = false;
          // 清理临时文件
          fs.unlink(tmpIn, function(){});
          fs.unlink(tmpOut, function(){});
          if (err2) { callback(err2); return; }
          callback(null, audio, 'audio/mpeg');
        });
      } else {
        _ttsBusy = false;
        fs.unlink(tmpIn, function(){});
        fs.unlink(tmpOut, function(){});
        callback(new Error('edge-tts exit ' + code + ': ' + stderr.slice(0, 150)));
      }
    });

    child.on('error', function(e) {
      _ttsBusy = false;
      fs.unlink(tmpIn, function(){});
      fs.unlink(tmpOut, function(){});
      callback(new Error('edge-tts not found: ' + e.message));
    });
  });
}

// ============ 启动 ============
// 初始化数据目录
ensureDir(path.join(__dirname, 'data'));
ensureDir(path.join(__dirname, 'data', 'chat_history'));
ensureDir(path.join(__dirname, 'data', 'teacher_logs'));
// 迁移旧数据
migrateOldData();

server.listen(CONFIG.port, '0.0.0.0', function() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║  🏺 陶艺AI知识库服务已启动          ║');
  console.log('╠══════════════════════════════════════╣');
  console.log('║  地址: http://localhost:' + CONFIG.port + '          ║');
  console.log('║  首页: http://localhost:' + CONFIG.port + '/login.html ║');
  console.log('║  问答: http://localhost:' + CONFIG.port + '/index.html ║');
  console.log('║  指导: http://localhost:' + CONFIG.port + '/guide.html ║');
  console.log('╠══════════════════════════════════════╣');
  console.log('║  DeepSeek: ' + (CONFIG.deepseek.key ? '✅' : '⚠️ 未配置') + '                        ║');
  console.log('║  Vision:   ' + (CONFIG.vision.key ? '✅' : '⚠️ 未配置') + '                        ║');
  console.log('╚══════════════════════════════════════╝');
});
