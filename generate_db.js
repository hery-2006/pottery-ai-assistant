const fs = require('fs');
const path = require('path');

const DB = path.join(__dirname, '问答数据库');
const CHAT = path.join(DB, 'chat_history');
const LOGS = path.join(DB, 'teacher_logs');

// ==================== 教师数据 ====================
const TEACHERS = [
  { id: 'T001', name: '张明远', title: '高级陶艺讲师' },
  { id: 'T002', name: '李素华', title: '陶艺副教授' },
  { id: 'T003', name: '王建国', title: '工艺美术师' }
];

// ==================== 学生数据（50名） ====================
function generateStudents() {
  const names = [
    '赵梦韩','钱思远','孙婉清','李慕白','周子璇','吴文昊','郑雅琴','王浩然','冯雨萱','陈思睿',
    '褚天宇','卫诗琪','蒋一鸣','沈佩珊','韩子轩','杨灵儿','朱子玉','秦雨桐','许晨曦','何嘉文',
    '吕思涵','张欣怡','施俊杰','孔令仪','曹梦琪','严志远','华语瞳','金明熙','魏雨桐','陶子安',
    '姜雨欣','戚雨桐','谢博文','邹雨萱','苏子涵','潘雨桐','葛天宇','范雨欣','彭思远','鲁雨桐',
    '马天宇','方雨萱','谭志远','贺雨桐','陆思涵','孟子欣','叶俊杰','胡雨桐','林晨曦','唐语嫣'
  ];
  var students = [];
  for (var i = 0; i < 50; i++) {
    var id = 'S' + String(2024001 + i).padStart(7, '0');
    var teacherIdx = i < 17 ? 0 : (i < 34 ? 1 : 2);
    students.push({
      id: id,
      name: names[i],
      role: 'student',
      teacherId: TEACHERS[teacherIdx].id,
      createdAt: new Date(2026, 5, 1 + Math.floor(i / 3)).toISOString()
    });
  }
  return students;
}

// ==================== 题库（10个步骤 × 10个问题） ====================
const QUESTION_BANK = {
  '揉泥': [
    '揉泥的主要目的是什么？',
    '羊头式和菊花式揉泥有什么区别？',
    '揉泥要揉到什么程度才算好？',
    '揉泥时手太干粘泥怎么办？',
    '泥料太硬揉不动怎么处理？',
    '揉泥过程中出现气泡怎么办？',
    '揉泥一般需要多长时间？',
    '揉泥台面有什么要求？',
    '揉泥时身体姿势应该是怎样的？',
    '如何判断泥料已经揉好了？'
  ],
  '定中心': [
    '定中心总是定不稳怎么办？',
    '泥团在拉坯机上晃动怎么解决？',
    '定中心时手臂应该放哪里？',
    '定中心转速多少合适？',
    '泥团偏心怎么调整？',
    '定中心时手要一直保持湿润吗？',
    '泥团太大定不了中心怎么办？',
    '定中心需要用到什么工具吗？',
    '怎么判断中心已经定好了？',
    '定中心时泥料总是飞出去怎么办？'
  ],
  '开孔': [
    '开孔时深度怎么控制？',
    '开孔总是偏斜不在中心怎么办？',
    '开孔底部要留多厚？',
    '开孔时拇指要用多大力度？',
    '开孔后底部发现有气泡怎么办？',
    '开孔和定中心之间要衔接多快？',
    '开孔时泥壁崩了是什么原因？',
    '开孔的形状有什么讲究？',
    '开孔的直径怎么确定？',
    '开孔到底是垂直压还是斜着压？'
  ],
  '拉高': [
    '拉高时泥壁总是塌下来怎么办？',
    '拉高提拉不均匀壁厚不一致怎么解决？',
    '拉高时手指应该怎么配合？',
    '拉高到多高比较合适？',
    '拉高过程中泥料变软塌了怎么办？',
    '拉高转速应该是多少？',
    '拉高时底部总是越拉越薄怎么办？',
    '拉高一次提拉多少高度最好？',
    '拉高时内外手怎么协调？',
    '拉高后直筒不垂直怎么修正？'
  ],
  '造型': [
    '造型时口部开裂怎么办？',
    '收口总是做不好有什么技巧？',
    '扩腹时泥壁塌陷了怎么补救？',
    '造型不对称一边大一边小怎么办？',
    '做瓶口有什么技巧？',
    '造型时转速应该调快还是调慢？',
    '做弧线造型手势应该怎么变化？',
    '底部留多少修坯余量合适？',
    '造型太复杂超出能力范围怎么办？',
    '怎么判断造型是否美观协调？'
  ],
  '修坯': [
    '修坯应该修多薄？',
    '修坯时坯体固定在转盘上晃动怎么办？',
    '修坯刀用哪种比较好？',
    '修坯时用力不均匀导致坑洼怎么办？',
    '修坯时坯体干湿度怎么判断？',
    '修坯的转速和拉坯转速一样吗？',
    '修圈足有什么技巧？',
    '修坯时发现底部有裂纹怎么办？',
    '修坯和拉坯有什么不同？',
    '修坯时如何感知壁厚是否均匀？'
  ],
  '干燥': [
    '干燥时坯体开裂了怎么办？',
    '阴干要多久才能干透？',
    '干燥过程中坯体变形了怎么预防？',
    '能不能用吹风机加速干燥？',
    '不同大小的坯体干燥时间一样吗？',
    '干燥到什么程度才能入窑？',
    '空心作品干燥要注意什么？',
    '坯体底部积水怎么处理？',
    '干燥环境有什么要求？',
    '坯体没干透就入窑会怎么样？'
  ],
  '素烧': [
    '素烧温度控制在多少度最合适？',
    '素烧时窑门什么时候关？',
    '300度前为什么要留缝？',
    '素烧过程中能开窑检查吗？',
    '素烧要烧多长时间？',
    '素烧后坯体颜色变成什么样算正常？',
    '素烧时炸坯了是什么原因？',
    '素烧完多久能开窑取件？',
    '素烧和釉烧有什么区别？',
    '素烧前坯体需要检查什么？'
  ],
  '上釉': [
    '釉料浓度怎么调配？',
    '上釉前坯体需要处理吗？',
    '荡釉法具体怎么操作？',
    '浸釉法要注意什么？',
    '喷釉时距离多远合适？',
    '底部釉没擦干净粘板了怎么办？',
    '上釉不均匀怎么补救？',
    '釉烧后颜色和釉料颜色不一样？',
    '素坯吸釉太快怎么办？',
    '上釉后能再补釉吗？'
  ],
  '釉烧': [
    '釉烧温度一般控制在多少度？',
    '釉烧升温曲线是怎样的？',
    '釉烧时作品之间要留空隙吗？',
    '为什么釉烧后釉面有针孔？',
    '釉烧后釉面流釉了是什么原因？',
    '釉烧和素烧的升温速度一样吗？',
    '釉烧后开窑温度多少合适？',
    '窑内不同位置烧制效果不同怎么办？',
    '釉烧失败的作品能重烧吗？',
    '如何判断釉烧是否成功？'
  ]
};

const STEPS = ['揉泥','定中心','开孔','拉高','造型','修坯','干燥','素烧','上釉','釉烧'];
const STEP_KEYS = Object.keys(QUESTION_BANK);

// ==================== 10名学生的弱点分布 ====================
// 每个学生各有2-3个薄弱环节，每个环节问10个问题
const STUDENT_PROFILES = [
  { idx: 0, name: '赵梦韩', weak: ['揉泥','定中心'], desc: '基础不牢固，揉泥和定中心需要加强' },
  { idx: 1, name: '钱思远', weak: ['修坯','造型'], desc: '造型审美和修坯精细度不足' },
  { idx: 2, name: '孙婉清', weak: ['开孔','拉高'], desc: '开孔深度控制和拉高均匀性有待提高' },
  { idx: 3, name: '李慕白', weak: ['上釉','釉烧'], desc: '对釉料特性和烧制温度把控不准' },
  { idx: 4, name: '周子璇', weak: ['干燥','素烧'], desc: '干燥和素烧环节经常出问题' },
  { idx: 5, name: '吴文昊', weak: ['造型','修坯','上釉'], desc: '造型到修坯到上釉整体流程需要梳理' },
  { idx: 6, name: '郑雅琴', weak: ['拉高','造型'], desc: '拉高后造型转换不流畅' },
  { idx: 7, name: '王浩然', weak: ['素烧','釉烧'], desc: '对烧制工艺理解不足' },
  { idx: 8, name: '冯雨萱', weak: ['揉泥','开孔','拉高'], desc: '拉坯前半段基本功薄弱' },
  { idx: 9, name: '陈思睿', weak: ['修坯','干燥','素烧'], desc: '拉坯后处理环节掌握不牢' },
  // T002组学生
  { idx: 17, name: '吕思涵', weak: ['揉泥'], desc: '揉泥基础需要重点练习' },
  { idx: 19, name: '孔令仪', weak: ['釉烧'], desc: '对釉烧温度控制需要指导' },
  { idx: 20, name: '曹梦琪', weak: ['定中心','开孔'], desc: '起始环节不扎实影响后续' },
  { idx: 21, name: '严志远', weak: ['造型'], desc: '造型创意和技法需要扩展' },
  { idx: 23, name: '金明熙', weak: ['上釉'], desc: '上釉手法需要系统学习' },
  // T003组学生
  { idx: 34, name: '苏子涵', weak: ['素烧','釉烧'], desc: '烧制环节需要加强' },
  { idx: 36, name: '葛天宇', weak: ['揉泥','定中心'], desc: '基础薄弱需要补课' },
  { idx: 38, name: '彭思远', weak: ['造型','修坯'], desc: '中后期造型修坯需要提升' },
  { idx: 40, name: '马天宇', weak: ['开孔','拉高'], desc: '拉坯上半段需要加强' },
  { idx: 42, name: '谭志远', weak: ['上釉','釉烧'], desc: '釉料和烧制需要系统学习' }
];

// ==================== 生成时间戳 ====================
function randomTime(baseDate, dayOffset, hourOffset) {
  var d = new Date(baseDate);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(8 + (hourOffset % 10), Math.floor(Math.random() * 60), 0, 0);
  return d.toISOString();
}

// ==================== 主生成逻辑 ====================
var students = generateStudents();
var allUsers = {};

// 添加教师
TEACHERS.forEach(function(t) {
  allUsers[t.id] = { id: t.id, name: t.name, role: 'teacher', title: t.title, createdAt: '2026-06-01T00:00:00.000Z' };
});

// 添加学生
students.forEach(function(s) {
  allUsers[s.id] = { id: s.id, name: s.name, role: 'student', teacherId: s.teacherId, createdAt: s.createdAt };
});

// 教师日志汇总
var teacherLogs = {};
TEACHERS.forEach(function(t) { teacherLogs[t.id] = []; });

// 学生的对话历史
var chatHistories = {};

// 生成模拟问答
var baseDate = new Date('2026-06-10');
var logIdx = 0;

STUDENT_PROFILES.forEach(function(profile) {
  var student = students[profile.idx];
  if (!student) return;
  var tId = student.teacherId;
  var chatMsgs = [];
  var welcomeMsg = { role: 'assistant', content: '你好！我是AI陶艺助手，有什么关于拉坯的问题可以问我～', timestamp: new Date(baseDate).toISOString() };
  chatMsgs.push(welcomeMsg);

  profile.weak.forEach(function(weakStep) {
    var questions = QUESTION_BANK[weakStep];
    if (!questions) return;
    // 每个薄弱环节问对应的问题
    questions.forEach(function(q, qi) {
      var dayOffset = logIdx % 20;
      var hourOffset = logIdx % 10;
      var ts = randomTime(baseDate, dayOffset, hourOffset);

      // 教师日志
      teacherLogs[tId].push({
        studentId: student.id,
        studentName: student.name,
        question: q,
        step: weakStep,
        stepIndex: STEP_KEYS.indexOf(weakStep),
        role: 'student',
        timestamp: ts
      });

      // 对话历史（学生问 + AI答）
      chatMsgs.push({ role: 'user', content: q, timestamp: ts });
      var aiAnswers = {
        '揉泥': '揉泥是拉坯的基础。羊头式适合较硬泥料，菊花式适合中等硬度。揉到泥料均匀无气泡、表面光滑即可。你可以切开检查内部是否还有气泡。',
        '定中心': '定中心的关键是手臂要有支撑点，固定在大腿或托盘边缘。双手湿润保持润滑，泥团完全静止不晃动才算定好。可以慢速开始，稳了再加速。',
        '开孔': '开孔拇指并拢从中心垂直向下压，底部留1-1.5cm厚度。保持匀速垂直，外侧手掌可以感受底部厚度。偏斜了可以重新定中心再开。',
        '拉高': '拉高时内外手间距保持一致，从底部均匀向上提拉。每次提拉不要贪多，2-3cm就够了。手要稳、速度要均匀，可以配合呼吸节奏。',
        '造型': '造型要在拉高的基础上逐步变化。收口从内侧推压，扩腹从内部向外推。对称是关键，从各个角度观察。口部开裂说明太干，要喷水保湿。',
        '修坯': '修坯在坯体七成干时进行（皮革硬度）。用修坯刀从底部开始均匀修整，注意壁厚。宁可多留余量也不要一次修太多，可以分几次完成。',
        '干燥': '坯体放在阴凉通风处自然阴干，不能阳光直射或风吹。底部用托板吸水防变形。空心作品要打孔排气。完全干透需要3-7天，小件快大件慢。',
        '素烧': '素烧500-800℃，300℃前窑门留5-10cm缝排水汽。250-300℃要检查有无炸坯，无异常关窑自动升温。降温至150℃以下才能取件。',
        '上釉': '釉料调至牛奶状浓度。内部用荡釉法，外部用浸釉或喷釉。底部接触硼板处必须擦干净，否则会粘板报废。不均匀可以补喷一遍。',
        '釉烧': '釉烧1200-1300℃，根据釉料特性调整。升温不能太快，降温更要慢。作品间留间隙防粘连。窑内不同位置温度略有差异，可以轮换位置。'
      };
      var answer = aiAnswers[weakStep] || '这个问题很好，建议多看看教学视频，结合实操练习效果更好。';
      chatMsgs.push({ role: 'assistant', content: answer, timestamp: ts });

      logIdx++;
    });
  });

  // 再加入一些随意的其他问题（每个学生2-3个其他步骤的问题）
  var otherSteps = STEP_KEYS.filter(function(s) { return profile.weak.indexOf(s) === -1; });
  for (var r = 0; r < 3 && otherSteps.length > 0; r++) {
    var randStep = otherSteps[Math.floor(Math.random() * otherSteps.length)];
    var randQ = QUESTION_BANK[randStep][Math.floor(Math.random() * QUESTION_BANK[randStep].length)];
    var ts = randomTime(baseDate, logIdx % 20, logIdx % 10);
    teacherLogs[tId].push({
      studentId: student.id, studentName: student.name, question: randQ,
      step: randStep, stepIndex: STEP_KEYS.indexOf(randStep), role: 'student', timestamp: ts
    });
    chatMsgs.push({ role: 'user', content: randQ, timestamp: ts });
    chatMsgs.push({ role: 'assistant', content: '这个问题很实用。建议在实操中多加练习，同时可以参考B站上的教学视频。', timestamp: ts });
    logIdx++;
  }

  chatHistories[student.id] = { id: student.id, name: student.name, messages: chatMsgs };
});

// ==================== 写入文件 ====================
fs.writeFileSync(path.join(DB, 'users.json'), JSON.stringify(allUsers, null, 2), 'utf8');
console.log('✓ users.json 已保存 (' + Object.keys(allUsers).length + ' 个用户)');

Object.keys(chatHistories).forEach(function(sid) {
  fs.writeFileSync(path.join(CHAT, sid + '.json'), JSON.stringify(chatHistories[sid], null, 2), 'utf8');
});
console.log('✓ chat_history 已保存 (' + Object.keys(chatHistories).length + ' 个学生对话)');

Object.keys(teacherLogs).forEach(function(tid) {
  fs.writeFileSync(path.join(LOGS, tid + '.json'), JSON.stringify(teacherLogs[tid], null, 2), 'utf8');
  console.log('✓ teacher_logs/' + tid + '.json 已保存 (' + teacherLogs[tid].length + ' 条记录)');
});

// 生成统计报告
var report = '# 问答数据库生成报告\n\n';
report += '## 教师统计\n\n';
report += '| 工号 | 姓名 | 学生数 | 提问总数 |\n|------|------|--------|----------|\n';
TEACHERS.forEach(function(t) {
  var studentCount = students.filter(function(s) { return s.teacherId === t.id; }).length;
  var logCount = teacherLogs[t.id].length;
  report += '| ' + t.id + ' | ' + t.name + ' | ' + studentCount + ' | ' + logCount + ' |\n';
});

report += '\n## 学生薄弱环节分布\n\n';
report += '| 学号 | 姓名 | 薄弱环节 | 提问数 |\n|------|------|----------|--------|\n';
STUDENT_PROFILES.forEach(function(p) {
  var s = students[p.idx];
  var qCount = 0;
  p.weak.forEach(function(w) { qCount += (QUESTION_BANK[w] || []).length; });
  report += '| ' + s.id + ' | ' + p.name + ' | ' + p.weak.join('、') + ' | ' + (qCount + 3) + ' |\n';
});

report += '\n## 数据概览\n\n';
report += '- 教师总数：' + TEACHERS.length + '\n';
report += '- 学生总数：' + students.length + '\n';
report += '- 模拟问答学生：' + STUDENT_PROFILES.length + '\n';
report += '- 提问总条数：' + logIdx + '\n';
report += '- 覆盖步骤：' + STEP_KEYS.join('、') + '\n';

fs.writeFileSync(path.join(DB, 'README.md'), report, 'utf8');
console.log('✓ README.md 已保存');
console.log('\n==== 生成完毕 ====');
console.log('教师：' + TEACHERS.length + ' 人');
console.log('学生：' + students.length + ' 人');
console.log('模拟问答学生：' + STUDENT_PROFILES.length + ' 人');
console.log('提问总条数：' + logIdx);
