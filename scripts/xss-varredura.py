# Varredura de XSS: lista interpolações ${...} em template literals que
# contêm HTML e cujo valor parece vir de dado (campo de objeto, mensagem de
# erro), sem passar por função de escape. Desce em templates aninhados
# (${cond ? `...${x}...` : ''}). Falso positivo é esperado — serve de lista
# de revisão, não de veredito.
#   python3 scripts/xss-varredura.py          → só leituras de campo (revisar)
#   python3 scripts/xss-varredura.py --tudo   → todas as interpolações suspeitas
import re, glob, sys

ESC = re.compile(r'(\b(escHtml|escapeHtml|esc|asEsc|asNum|_\w*Esc\w*|_\w*Escapar\w*|_\w*EscapeHtml|encodeURIComponent|JSON\.stringify|Number|parseInt|parseFloat|Math\.\w+|\w*[Ff]mt\w*|formatar\w*|\w*[Ff]ormat\w*|\w*Moeda\w*|\w*Badge\w*|\w*Icone?\w*|\w*Html\w*|\w*HTML\w*|status)\s*\(|\.toFixed|\.toLocaleString|\.length\b|\.join\(|\.map\()')
SEGURO = re.compile(r'^\s*(i|idx|index|n|num|total|qtd|count|pct|w|h|x|y|cor|cls|classe|icone|icon|tipo|status|st|pfx|\w*Id|id|\w+\.id|\w+\.uuid|\w*Cls|\w*Class\w*|\w*[Cc]or\w*)\s*$')
CONFIG = re.compile(r'^\s*(cfg|config|col|plano|prox|porModelo|info|saldo|tipo|s|o)\.')

def templates(s):
    i, n = 0, len(s)
    while i < n:
        c = s[i]
        if c == '`':
            j, depth = i + 1, 0
            while j < n:
                ch = s[j]
                if ch == '\\': j += 2; continue
                if ch == '`' and depth == 0: break
                if s.startswith('${', j): depth += 1; j += 2; continue
                if ch == '}' and depth > 0: depth -= 1
                elif ch == '`' and depth > 0:   # template aninhado: pula inteiro
                    k = j + 1; d2 = 0
                    while k < n and not (s[k] == '`' and d2 == 0):
                        if s[k] == '\\': k += 2; continue
                        if s.startswith('${', k): d2 += 1; k += 2; continue
                        if s[k] == '}' and d2 > 0: d2 -= 1
                        k += 1
                    j = k
                j += 1
            yield i, s[i:j + 1]
            i = j + 1
        elif c in '\'"':
            j = i + 1
            while j < n and s[j] != c and s[j] != '\n':
                if s[j] == '\\': j += 1
                j += 1
            i = j + 1
        elif s.startswith('//', i):
            j = s.find('\n', i); i = n if j < 0 else j
        elif s.startswith('/*', i):
            j = s.find('*/', i); i = n if j < 0 else j + 2
        else:
            i += 1

def interps(t):
    out, i = [], 0
    while True:
        k = t.find('${', i)
        if k < 0: return out
        d, j = 1, k + 2
        while j < len(t) and d:
            if t[j] == '`':   # pula template aninhado dentro da expressão
                j += 1; d2 = 0
                while j < len(t) and not (t[j] == '`' and d2 == 0):
                    if t[j] == '\\': j += 2; continue
                    if t.startswith('${', j): d2 += 1; j += 2; continue
                    if t[j] == '}' and d2 > 0: d2 -= 1
                    j += 1
            elif t[j] == '{': d += 1
            elif t[j] == '}': d -= 1
            j += 1
        out.append((k, t[k + 2:j - 1])); i = j

def todos(texto, base, em_html=False):
    # um template aninhado herda "está dentro de HTML" do template pai
    for st, t in templates(texto):
        html = em_html or '<' in t
        yield base + st, t, html
        for k, e in interps(t):
            if '`' in e:
                yield from todos(e, base + st + k + 2, html)

tudo = '--tudo' in sys.argv
total = 0
for f in sorted(glob.glob('*.js')):
    if f.endswith('.min.js') or f.startswith('pdf-'): continue
    s = open(f, encoding='utf8').read()
    vistos = set()
    for st, t, html in todos(s, 0):
        if not html: continue
        for k, e in interps(t):
            ex = e.strip()
            if '`' in ex or not re.search(r'[A-Za-z_]', ex): continue
            if ESC.search(ex) or SEGURO.match(ex) or re.fullmatch(r"['\"][^'\"]*['\"]", ex): continue
            if not tudo:
                dado = re.search(r'\b(err|error|e|erro)\.message\b', ex) or re.search(r'\b[a-z_]\w*(\?\.|\.)(?!id\b|length\b|toFixed|[A-Z])[a-z_]\w*', ex)
                if not dado or CONFIG.match(ex) or re.search(r"\?\s*'[^']*'\s*:\s*'[^']*'\s*$", ex): continue
            linha = s[:st + k].count('\n') + 1
            if (linha, ex) in vistos: continue
            vistos.add((linha, ex)); total += 1
            print(f'{f}:{linha}  ${{{ex[:90]}}}')
print('TOTAL', total, file=sys.stderr)
