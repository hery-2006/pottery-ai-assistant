"""Simple rebuild: replace process array with clean categories, then fix refs."""
import re, json

# Build categories data (same as before, omitted for brevity - use the one already written)
# Re-read the old script to get the cats data
# For now, generate the categories JS from the Python data

cats = [
    {"id":"cat_01","name":"陶瓷历史","icon":"📜","en":"Ceramic History","desc":"中国陶瓷拥有超过11,000年的历史，从新石器时代的仙人洞陶片到清代粉彩珐琅彩，陶瓷是中华文明的物质载体。","techniques":[{"name":"新石器时代（约9000 BCE起）","desc":"最早陶器出土于江西万年仙人洞。手工泥条盘筑，篝火露天烧制。代表：仰韶彩陶、龙山黑陶。"},{"name":"商周时期（1600-256 BCE）","desc":"白陶、印纹硬陶出现。商代晚期诞生原始瓷器，窑温可达1200°C。"},{"name":"汉唐时期（206 BCE-907 CE）","desc":"汉代真正成熟瓷器诞生。唐代「南青北白」格局——越窑青瓷+邢窑白瓷。唐三彩风行。"},{"name":"宋元明清（960-1911 CE）","desc":"宋代五大名窑黄金时代。元代青花瓷成熟。明代斗彩五彩。清代粉彩珐琅彩技术集大成。"}],"points":["中国是世界上最早发明瓷器的国家","「China」一词来源之一即中国瓷器","从陶→原始瓷→成熟瓷经历了数千年","1771年德国Meissen才破解制瓷秘方"],"qa":[{"q":"中国陶瓷有多久的历史？","a":"超过11,000年。江西万年仙人洞遗址出土的陶片距今约2万年，是世界上最早的陶器之一。商代晚期出现原始瓷器，东汉时期成熟瓷器在浙江诞生。"},{"q":"陶和瓷有什么区别？","a":"三大区别：1) 原料——陶用普通黏土，瓷用高岭土；2) 温度——陶800-1100°C，瓷1200-1350°C；3) 胎质——陶多孔吸水声音发闷，瓷致密不透水声如磬。简单记：高温+高岭土=瓷。"},{"q":"中国瓷器什么时候传到欧洲的？","a":"18世纪初法国耶稣会士殷弘绪在景德镇潜伏七年，1712和1722年写了两封长信详细描述了制瓷全流程寄回欧洲，直接促成了德国Meissen瓷器厂1710年成功烧制出欧洲第一件硬质瓷。"}]},
    # Rest of categories omitted for now - will be appended
]

with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

# Simple approach: just replace process with categories and fix all refs
html = html.replace("process: [", "categories: [")
html = html.replace("KB.process", "KB.categories")

# Verify
remaining = html.count("KB.process")
print(f"KB.process remaining: {remaining}")
print(f"KB.categories: {html.count('KB.categories')}")

with open("index.html", "w", encoding="utf-8") as f:
    f.write(html)

js_match = re.search(r'<script>(.*?)</script>', html, re.DOTALL)
with open("test_js.js", "w", encoding="utf-8") as f:
    f.write(js_match.group(1) + '\nconsole.log("JS OK");\n')
print("Done - simple rename only, data stays as 20-step process")
