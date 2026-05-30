"""Fix ALL inner quotes in the entire file using state machine."""
import re

with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

result = []
i = 0
in_key = False
in_value = False
fixes = 0

while i < len(html):
    ch = html[i]

    if ch == '"' and not in_key and not in_value:
        before = html[max(0,i-30):i].rstrip()
        is_arr_val = False
        if before.endswith('",'):
            lookahead = html[i+1:min(len(html), i+50)]
            if not re.match(r'[a-zA-Z_$][a-zA-Z0-9_$]*"\s*:', lookahead.strip()):
                # Extra check: not a JS object key (no : following)
                is_arr_val = True
        if before.endswith(':') or before.endswith('[') or is_arr_val:
            in_value = True
            result.append(ch); i += 1
            inner_fixes = 0
            while i < len(html):
                vch = html[i]
                if vch == '\\' and i+1 < len(html):
                    result.append(vch); result.append(html[i+1]); i += 2; continue
                if vch == '"':
                    ahead = html[i+1:min(len(html), i+5)].lstrip()
                    if ahead and ahead[0] in ',}\n]':
                        result.append(vch); i += 1; break
                    else:
                        result.append('「' if inner_fixes % 2 == 0 else '」')
                        inner_fixes += 1; fixes += 1; i += 1
                else:
                    result.append(vch); i += 1
            in_value = False
            while i < len(html) and html[i] in ' \t':
                result.append(html[i]); i += 1
            if i < len(html) and html[i] == ',':
                result.append(html[i]); i += 1
            continue
        else:
            in_key = True; result.append(ch); i += 1
            while i < len(html):
                result.append(html[i])
                if html[i] == '"' and html[i-1] != '\\': i += 1; break
                i += 1
            in_key = False; continue
    result.append(ch); i += 1

html = ''.join(result)
print(f"Total fixes: {fixes}")

with open("index.html", "w", encoding="utf-8") as f:
    f.write(html)

js_match = re.search(r'<script>(.*?)</script>', html, re.DOTALL)
with open("test_js.js", "w", encoding="utf-8") as f:
    f.write(js_match.group(1) + '\nconsole.log("JS OK");\n')
print("Done")
