// Derived from the user-installed SuperADC 0.580.0. See PROVENANCE.json.
import Ot, { randomUUID as Dn, createHash as Hl, randomBytes as hwe } from "node:crypto";

import J, { statSync as dO, existsSync as FI, mkdtempSync as mwe, rmSync as gwe, readFileSync as ywe, unwatchFile as aB, watchFile as _we, watch as bwe, stat as wwe, createReadStream as Swe, mkdirSync as vwe, copyFileSync as Iwe, constants as Awe } from "node:fs";

import z, { join as vd, resolve as ea, sep as LI, basename as kwe, dirname as Ewe } from "node:path";

import fr, { homedir as lSe, type as uSe } from "node:os";

function kx() { return process.env.PPT_WORKBENCH_HOME || z.join(fr.homedir(), ".ppt-workbench"); }

import QE from "jszip";

const yc = "super-adc-deck.json";

const yw = /^[A-Za-z0-9_-]{1,64}$/;

function Mte(e) {
  const t = [];
  let n;
  try {
    n = JSON.parse(e);
  } catch (c) {
    return {
      manifest: null,
      diagnostics: [{ level: "error", code: "manifest_json", message: `清单不是合法的 JSON：${c instanceof Error ? c.message : String(c)}` }]
    };
  }
  if (!n || typeof n != "object" || Array.isArray(n))
    return { manifest: null, diagnostics: [{ level: "error", code: "manifest_shape", message: "清单必须是一个 JSON 对象" }] };
  const r = n, s = typeof r.title == "string" && r.title.trim() ? r.title.trim() : "未命名演示文稿";
  (typeof r.title != "string" || !r.title.trim()) && t.push({ level: "warning", code: "manifest_title", message: "清单缺少 title，已显示为“未命名演示文稿”" });
  const i = [];
  if (!Array.isArray(r.order))
    t.push({ level: "error", code: "manifest_order", message: "清单缺少 order 数组" });
  else {
    const c = /* @__PURE__ */ new Set();
    for (const l of r.order) {
      if (typeof l != "string" || !yw.test(l)) {
        t.push({ level: "error", code: "slide_id", message: `页 id 不合法：${JSON.stringify(l)}（只允许字母、数字、- 和 _，最长 64）` });
        continue;
      }
      if (c.has(l)) {
        t.push({ level: "warning", slide: l, code: "slide_duplicate", message: `页 id 重复：${l}` });
        continue;
      }
      c.add(l), i.push(l);
    }
  }
  let o;
  return r.fonts !== void 0 && (Array.isArray(r.fonts) && r.fonts.every((c) => typeof c == "string") ? o = r.fonts : t.push({ level: "warning", code: "manifest_fonts", message: "清单的 fonts 必须是字符串数组，已忽略" })), { manifest: { v: typeof r.v == "number" ? r.v : 0, title: s, order: i, ...o ? { fonts: o } : {} }, diagnostics: t };
}

function B6(e) {
  try {
    const t = J.statSync(e);
    return `${t.mtimeMs}:${t.size}`;
  } catch {
    return "missing";
  }
}

function xh(e) {
  return z.join(z.dirname(e), "slides");
}

function Um(e, t = {}) {
  const n = z.dirname(e), r = [], s = [B6(e)];
  z.basename(e) !== yc && r.push({ level: "error", code: "manifest_name", message: `清单文件必须命名为 ${yc}` });
  let i = null;
  try {
    const p = Mte(J.readFileSync(e, "utf8"));
    i = p.manifest, r.push(...p.diagnostics);
  } catch (p) {
    r.push({ level: "error", code: "manifest_read", message: `读不到清单：${p instanceof Error ? p.message : String(p)}` });
  }
  const o = xh(e);
  let a = [];
  try {
    a = J.readdirSync(o).filter((p) => p.endsWith(".html")).map((p) => p.slice(0, -5)).filter((p) => yw.test(p)).sort();
  } catch {
    a = [];
  }
  s.push(a.join(","));
  const c = [], l = i?.order ?? [], u = new Set(l), d = (p, h) => {
    const m = z.join(o, `${p}.html`), g = B6(m);
    s.push(`${p}=${g}`);
    const y = g !== "missing", b = { id: p, filePath: m, inOrder: h, exists: y, rev: g };
    if (!y)
      r.push({ level: "warning", slide: p, code: "slide_missing", message: `order 中的页面文件不存在：slides/${p}.html` });
    else if (t.readSources)
      try {
        b.source = J.readFileSync(m, "utf8");
      } catch (w) {
        b.exists = !1, r.push({ level: "error", slide: p, code: "slide_read", message: `读不到页面文件：${w instanceof Error ? w.message : String(w)}` });
      }
    c.push(b);
  };
  for (const p of l) d(p, !0);
  for (const p of a) u.has(p) || d(p, !1);
  const f = Ot.createHash("sha1").update(s.join("|")).digest("hex").slice(0, 16);
  return { manifestPath: e, dir: n, manifest: i, slides: c, diagnostics: r, version: f };
}

const Wf = "Microsoft YaHei";

const i0 = "Source Han Sans SC";

const iFt = "本机没有微软雅黑和思源黑体，预览使用替代字体，与 PowerPoint 的效果可能不同。";

const CM = ["Microsoft YaHei", "微软雅黑"];

const OY = ["Source Han Sans SC", "思源黑体"];

function Gf(e, t) {
  try {
    return t(e);
  } catch {
    return !1;
  }
}

function Vf(e) {
  return [
    { weight: 400, source: { kind: "local", names: e } },
    { weight: 700, source: { kind: "local", names: e } }
  ];
}

function RM(e, t) {
  return [
    { weight: 400, source: { kind: "file", path: e } },
    { weight: 700, source: { kind: "file", path: t } }
  ];
}

function oFt(e) {
  const t = e?.fonts?.map((n) => n.trim()).filter(Boolean) ?? [];
  return !t.length || t.every((n) => n === "default") ? null : t[0] || null;
}

function l_e(e, t) {
  return e.faces.map((n) => [
    "@font-face {",
    `  font-family: ${JSON.stringify(e.family)};`,
    `  font-weight: ${n.weight};`,
    "  font-style: normal;",
    "  font-display: swap;",
    `  src: ${t(n)};`,
    "}"
  ].join(`
`)).join(`
`);
}

function $F(e) {
  return e.map((t) => `local(${JSON.stringify(t)})`).join(", ");
}

function u_e(e, t = {}) {
  const n = t.platform || process.platform, r = t.exists || ((I) => {
    try {
      return J.statSync(I).isFile();
    } catch {
      return !1;
    }
  }), s = t.homeDir || fr.homedir(), i = t.superAdcHome || kx(), o = t.powerpointFontsDir || (n === "darwin" ? "/Applications/Microsoft PowerPoint.app/Contents/Resources/DFonts" : ""), a = o ? z.join(o, "msyh.ttc") : "", c = o ? z.join(o, "msyhbd.ttc") : "", l = !!(a && c && Gf(a, r) && Gf(c, r)), u = [
    z.join(s, "Library", "Fonts", "SourceHanSansSC-Regular.otf"),
    z.join("/Library/Fonts", "SourceHanSansSC-Regular.otf")
  ], d = [
    z.join(s, "Library", "Fonts", "SourceHanSansSC-Bold.otf"),
    z.join("/Library/Fonts", "SourceHanSansSC-Bold.otf")
  ], f = n === "darwin" && u.some((I, S) => Gf(I, r) && Gf(d[S] || "", r)), p = z.join(i, "fonts", "source-han-sans-sc"), h = z.join(p, "SourceHanSansSC-Regular.otf"), m = z.join(p, "SourceHanSansSC-Bold.otf"), g = Gf(h, r) && Gf(m, r), y = () => l ? { family: Wf, faces: RM(a, c), reason: "使用本机 PowerPoint 自带的微软雅黑" } : n === "win32" ? { family: Wf, faces: Vf(CM), reason: "Windows 默认" } : { family: Wf, faces: Vf(CM), reason: "清单指定微软雅黑", warning: "指定的微软雅黑在本机找不到。" }, b = (I) => f ? { family: i0, faces: Vf(OY), reason: I } : g ? { family: i0, faces: RM(h, m), reason: I } : { family: i0, faces: Vf(OY), reason: I, warning: iFt }, w = oFt(e);
  if (w === Wf) return y();
  if (w === i0) {
    const I = b("清单指定思源黑体");
    return !f && !g && (I.warning = "指定的思源黑体在本机找不到。"), I;
  }
  return w ? {
    family: w,
    faces: Vf([w]),
    reason: "清单指定字体",
    warning: `指定的字体 ${w} 未在本机解析为已知字体文件。`
  } : n === "win32" ? { family: Wf, faces: Vf(CM), reason: "Windows 默认" } : l ? { family: Wf, faces: RM(a, c), reason: "使用本机 PowerPoint 自带的微软雅黑" } : b(f ? "本机已安装思源黑体" : g ? "使用数据目录中的思源黑体" : "Mac 默认思源黑体");
}

function $Ft() {
  var e = /* @__PURE__ */ new Set(["H1", "H2", "H3", "P", "LI"]), t = ["B", "STRONG", "I", "EM", "U", "SPAN", "A", "BR"], n = new Set(["SECTION", "DIV", "H1", "H2", "H3", "P", "UL", "OL", "LI", "IMG", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD", "X-SHAPE", "X-LINE", "ASIDE"].concat(t)), r = /* @__PURE__ */ new Set(["svg", "path", "rect", "circle", "ellipse", "polygon", "polyline", "g", "defs", "linearGradient", "stop"]), s = /* @__PURE__ */ new Set(["rect", "roundRect", "ellipse", "triangle", "diamond", "chevron", "homePlate", "rightArrow"]), i = /* @__PURE__ */ new Set(["none", "triangle", "stealth", "arrow", "oval", "diamond"]), o = {
    "*": ["style"],
    SECTION: ["id", "style"],
    IMG: ["src", "alt", "style"],
    A: ["href", "style"],
    "X-SHAPE": ["kind", "style"],
    "X-LINE": ["x1", "y1", "x2", "y2", "stroke", "stroke-width", "dash", "start", "end"]
  }, a = /* @__PURE__ */ new Set([
    "viewBox",
    "width",
    "height",
    "xmlns",
    "aria-label",
    "style",
    "d",
    "x",
    "y",
    "rx",
    "ry",
    "cx",
    "cy",
    "r",
    "points",
    "fill",
    "stroke",
    "stroke-width",
    "opacity",
    "fill-opacity",
    "stroke-opacity",
    "id",
    "offset",
    "stop-color",
    "stop-opacity",
    "x1",
    "y1",
    "x2",
    "y2",
    "transform",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-dasharray",
    "preserveAspectRatio"
  ]), c = [
    /^background-(color|image)$/,
    /^display$/,
    /^flex(-direction|-grow|-shrink|-basis)?$/,
    /^(row|column)-gap$/,
    /^align-(items|self|content)$/,
    /^justify-(content|items|self)$/,
    /^grid-template-(columns|rows)$/,
    /^grid-(column|row)-(start|end)$/,
    /^(min-)?(width|height)$/,
    /^max-(width|height)$/,
    /^padding-(top|right|bottom|left)$/,
    /^position$/,
    /^(left|top|right|bottom)$/,
    /^transform$/,
    /^border-(top|right|bottom|left)-(width|style|color)$/,
    /^border-(top|bottom)-(left|right)-radius$/,
    /^box-shadow$/,
    /^opacity$/,
    /^font-(family|size|weight|style)$/,
    /^color$/,
    /^line-height$/,
    /^letter-spacing$/,
    /^text-align$/,
    /^text-decoration(-line)?$/,
    /^vertical-align$/,
    /^object-fit$/,
    /^list-style-type$/,
    /^white-space$/,
    /^flex-wrap$/
  ], l = {
    margin: "用 gap 或 padding 控制间距",
    "z-index": "叠放顺序由元素先后决定",
    overflow: "内容放不下请拆页",
    filter: "PPT 没有对应效果",
    "clip-path": "PPT 没有对应效果",
    mask: "PPT 没有对应效果",
    "mix-blend-mode": "PPT 没有混合模式",
    "text-shadow": "文字阴影暂未开放",
    animation: "动画暂未开放",
    transition: "动画暂未开放",
    float: "用 flex/grid 布局"
  }, u = /(\d)(em|rem|vw|vh|vmin|vmax|pt|cm|mm|in|ch|ex)\b/, d = "http://www.w3.org/2000/svg", f = [];
  function p() {
    return document.querySelector("section");
  }
  function h(P) {
    for (var C = [], N = P; N && N.nodeType === 1 && N.tagName !== "BODY"; ) {
      var V = N.parentElement, W = V ? Array.prototype.indexOf.call(V.children, N) + 1 : 1;
      C.unshift(N.tagName.toLowerCase() + (N.tagName === "SECTION" ? "#" + N.id : ":nth-child(" + W + ")")), N = V;
    }
    return C.join(" > ");
  }
  function m(P, C, N) {
    f.push({ level: P, path: C ? h(C) : "", message: N });
  }
  function g(P) {
    for (var C = [], N = 0, V = "", W = 0; W < P.length; W += 1) {
      var oe = P[W];
      oe === "(" && (N += 1), oe === ")" && (N -= 1), oe === "," && N === 0 ? (C.push(V.trim()), V = "") : V += oe;
    }
    return V.trim() && C.push(V.trim()), C;
  }
  function y(P) {
    var C = P.getAttribute("style");
    !C || typeof CSS > "u" || typeof CSS.supports != "function" || C.split(";").forEach(function(N) {
      var V = N.indexOf(":");
      if (!(V < 0)) {
        var W = N.slice(0, V).trim().toLowerCase(), oe = N.slice(V + 1).trim();
        !W || !oe || W.indexOf("--") === 0 || CSS.supports(W, oe) || m("error", P, "无效的样式 " + W + ": " + oe + "（浏览器会忽略它" + (/^-?[\d.]+$/.test(oe) ? "，长度要写 px" : "") + "）");
      }
    });
  }
  function b(P) {
    y(P);
    for (var C = P.style, N = 0; N < C.length; N += 1) {
      var V = C[N], W = C.getPropertyValue(V).trim(), oe = c.some(function(pe) {
        return pe.test(V);
      });
      if (!oe) {
        if (W === "initial" || W === "normal" || W === "none" || W === "0px" || W === "auto") continue;
        var de = Object.keys(l).find(function(pe) {
          return V.indexOf(pe) === 0;
        });
        m("error", P, "不允许的样式 " + V + ": " + W + (de ? "（" + l[de] + "）" : ""));
        continue;
      }
      u.test(W) && m("error", P, V + " 只能用 px：" + W), /url\(/.test(W) && m("error", P, V + " 不允许 url()"), V === "position" && ["absolute", "relative", "static"].indexOf(W) < 0 && m("error", P, "position 只允许 absolute：" + W), V === "display" && ["flex", "grid", "block", "none", "inline", "list-item"].indexOf(W) < 0 && m("error", P, "display 不允许 " + W), V === "transform" && W !== "none" && !/^rotate\(-?[\d.]+deg\)$/.test(W) && m("error", P, "transform 只允许 rotate(Ndeg)：" + W), V === "transform" && W !== "none" && P.style.position !== "absolute" && m("error", P, "rotate 只能用在绝对定位元素上"), V === "background-image" && W !== "none" && W !== "initial" && !/^(linear|radial)-gradient\(/.test(W) && m("error", P, "背景只允许纯色或渐变：" + W), V === "background-image" && /^linear-gradient\(\s*to /.test(W) && m("error", P, "线性渐变请写角度，例如 linear-gradient(135deg, …)"), V === "box-shadow" && W !== "none" && g(W).length > 1 && m("error", P, "每个元素只允许一个阴影"), V === "font-weight" && ["400", "700", "normal", "bold"].indexOf(W) < 0 && m("error", P, "font-weight 只允许 400/700：" + W), V === "line-height" && W !== "normal" && !/^[\d.]+$/.test(W) && m("error", P, "line-height 只允许无单位倍数：" + W);
    }
  }
  function w() {
    var P = p();
    if (!P)
      return m("error", null, "页面缺少 <section>"), f;
    var C = Array.prototype.filter.call(document.body.children, function(W) {
      return W.tagName !== "SCRIPT";
    });
    C.length !== 1 && m("error", null, "页面文件只能包含一个 <section>");
    var N = 0, V = function(W, oe) {
      N += 1, oe > 15 && m("error", W, "嵌套超过 15 层");
      var de = W.namespaceURI === d;
      if (de) {
        r.has(W.tagName) || m("error", W, "svg 中不允许 <" + W.tagName + ">");
        for (var pe = 0; pe < W.attributes.length; pe += 1)
          a.has(W.attributes[pe].name) || m("error", W, "svg 属性不允许：" + W.attributes[pe].name);
        W.tagName === "path" && /[^MLHVCSQTZAmlhvcsqtza\d\s.,eE+-]/.test(W.getAttribute("d") || "") && m("error", W, "path 的 d 含有无法识别的字符"), W.tagName === "g" && W.getAttribute("transform") && !/^\s*translate\([^)]*\)\s*$/.test(W.getAttribute("transform")) && m("error", W, "g 只允许 translate()"), W.tagName !== "g" && W.tagName !== "svg" && W.getAttribute("transform") && m("error", W, "图形元素不允许 transform，请放到 g 上用 translate");
      } else {
        n.has(W.tagName) || m("error", W, "不允许的元素 <" + W.tagName.toLowerCase() + ">");
        for (var Se = o[W.tagName] || o["*"], be = 0; be < W.attributes.length; be += 1)
          Se.indexOf(W.attributes[be].name) < 0 && m("error", W, "不允许的属性 " + W.attributes[be].name);
        if (W.tagName === "X-SHAPE" && !s.has(W.getAttribute("kind") || "") && m("error", W, "x-shape kind 只允许：" + Array.from(s).join(", ")), W.tagName === "X-LINE" && (["x1", "y1", "x2", "y2"].forEach(function(fe) {
          /^-?[\d.]+$/.test(W.getAttribute(fe) || "") || m("error", W, "x-line 缺少数值 " + fe);
        }), ["start", "end"].forEach(function(fe) {
          W.hasAttribute(fe) && !i.has(W.getAttribute(fe)) && m("error", W, "x-line " + fe + " 不允许 " + W.getAttribute(fe));
        })), W.tagName === "IMG" && (!/^assets\/[^\\]+$/.test(W.getAttribute("src") || "") || (W.getAttribute("src") || "").indexOf("..") >= 0) ? m("error", W, "图片只能引用工程内 assets/ 的相对路径") : W.tagName === "IMG" && !/\.(png|jpe?g|gif)$/i.test(W.getAttribute("src") || "") ? m("error", W, "图片格式 " + ((W.getAttribute("src") || "").match(/\.[^./]*$/) || ["（无扩展名）"])[0] + " 不能放进 PPT，请先转成 .jpg 或 .png") : W.tagName === "IMG" && W.complete && !W.naturalWidth && m("error", W, "图片不存在或无法解码：" + W.getAttribute("src")), (W.tagName === "TD" || W.tagName === "TH") && (W.hasAttribute("colspan") || W.hasAttribute("rowspan")) && m("error", W, "暂不支持合并单元格"), W.tagName === "TABLE") {
          var Me = Array.prototype.map.call(W.querySelectorAll("tr"), function(fe) {
            return fe.children.length;
          });
          (!Me.length || Me.some(function(fe) {
            return fe === 0 || fe !== Me[0];
          })) && m("error", W, "表格每一行的单元格数必须相同且不为空（现在是 " + (Me.join("/") || "0") + "）");
        }
        b(W);
      }
      for (var x = 0; x < W.children.length; x += 1) V(W.children[x], oe + 1);
    };
    return V(P, 0), N > 200 && m("error", P, "元素数量 " + N + " 超过 200"), !P.style.backgroundColor && !P.style.backgroundImage && m("error", P, "section 必须设置 background"), f;
  }
  function I(P, C, N) {
    if (C === void 0 && (C = 1), !P || P === "transparent" || P === "none") return null;
    var V = P.match(/rgba?\(([^)]+)\)/);
    if (!V) return null;
    var W = V[1].split(/[ ,/]+/).filter(Boolean).map(Number), oe = (W.length > 3 ? W[3] : 1) * C;
    if (oe <= 0 && !N) return null;
    var de = W.slice(0, 3).map(function(pe) {
      return Math.round(pe).toString(16).padStart(2, "0");
    }).join("").toUpperCase();
    return { hex: de, a: Math.round(oe * 1e3) / 1e3 };
  }
  function S(P) {
    var C = document.createElement("span");
    C.style.color = P, document.body.appendChild(C);
    var N = getComputedStyle(C).color;
    return C.remove(), N;
  }
  function E(P) {
    for (var C = 1, N = P; N && N.nodeType === 1; N = N.parentElement) C *= Number(getComputedStyle(N).opacity || 1);
    return C;
  }
  function M() {
    return p().getBoundingClientRect();
  }
  function F(P) {
    var C = P.match(/matrix\(([^)]+)\)/);
    if (!C) return 0;
    var N = C[1].split(",").map(Number);
    return Math.round(Math.atan2(N[1], N[0]) * 180 / Math.PI * 100) / 100;
  }
  function L(P) {
    var C = M(), N = getComputedStyle(P), V = N.transform && N.transform !== "none" ? F(N.transform) : 0, W = P.getBoundingClientRect();
    if (V) {
      var oe = P.offsetWidth, de = P.offsetHeight;
      return { x: W.left - C.left + W.width / 2 - oe / 2, y: W.top - C.top + W.height / 2 - de / 2, w: oe, h: de, rot: V };
    }
    return { x: W.left - C.left, y: W.top - C.top, w: W.width, h: W.height, rot: 0 };
  }
  function D(P, C) {
    var N = P.match(/^(linear|radial)-gradient\(([\s\S]*)\)$/);
    if (!N) return null;
    var V = g(N[2]), W = 180, oe = { x: 50, y: 50 };
    if (N[1] === "linear" && /deg$/.test(V[0]) && (W = parseFloat(V.shift())), N[1] === "radial" && !/^rgba?\(/.test(V[0])) {
      var de = V.shift().match(/at\s+([\d.]+)%\s+([\d.]+)%/);
      de && (oe = { x: Number(de[1]), y: Number(de[2]) });
    }
    var pe = V.map(function(Se) {
      var be = Se.match(/(rgba?\([^)]+\))\s*([\d.]+%)?/);
      return { color: I(be && be[1], C, !0), pos: be && be[2] ? parseFloat(be[2]) : null };
    }).filter(function(Se) {
      return Se.color;
    });
    return pe.forEach(function(Se, be) {
      Se.pos == null && (Se.pos = pe.length === 1 ? 0 : be / (pe.length - 1) * 100);
    }), N[1] === "linear" ? { type: "linear", angle: W, stops: pe } : { type: "radial", center: oe, stops: pe };
  }
  function B(P, C) {
    if (P.backgroundImage && P.backgroundImage !== "none") return D(P.backgroundImage, C);
    var N = I(P.backgroundColor, C);
    return N ? { type: "solid", color: N } : null;
  }
  function A(P, C) {
    var N = parseFloat(P.borderTopWidth);
    if (!N || P.borderTopStyle === "none") return null;
    var V = ["Top", "Right", "Bottom", "Left"].every(function(W) {
      return P["border" + W + "Width"] === P.borderTopWidth && P["border" + W + "Style"] === P.borderTopStyle && P["border" + W + "Color"] === P.borderTopColor;
    });
    return V ? { w: N, color: I(P.borderTopColor, C), dash: P.borderTopStyle } : { nonUniform: !0 };
  }
  function T(P, C) {
    if (!P.boxShadow || P.boxShadow === "none") return null;
    var N = P.boxShadow, V = N.match(/rgba?\([^)]+\)/), W = I(V && V[0], C), oe = N.replace(/rgba?\([^)]+\)/, "").replace("inset", "").trim().split(/\s+/).map(parseFloat);
    return { inset: /inset/.test(N), x: oe[0] || 0, y: oe[1] || 0, blur: oe[2] || 0, spread: oe[3] || 0, color: W };
  }
  function k(P) {
    return P.backgroundImage && P.backgroundImage !== "none" || I(P.backgroundColor) || parseFloat(P.borderTopWidth) && P.borderTopStyle !== "none" || P.boxShadow && P.boxShadow !== "none";
  }
  function R(P) {
    return parseFloat(P.borderTopLeftRadius) || 0;
  }
  function K(P) {
    var C = function(N) {
      return parseFloat(P["padding" + N]) + parseFloat(P["border" + N + "Width"] || 0);
    };
    return { l: C("Left"), t: C("Top"), r: C("Right"), b: C("Bottom") };
  }
  function G(P, C) {
    var N = getComputedStyle(P);
    return {
      font: N.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
      size: parseFloat(N.fontSize),
      bold: Number(N.fontWeight) >= 600,
      italic: N.fontStyle === "italic",
      underline: /underline/.test(N.textDecorationLine),
      color: I(N.color, C),
      spacing: N.letterSpacing === "normal" ? 0 : parseFloat(N.letterSpacing)
    };
  }
  function Y(P, C) {
    var N = [], V = null, W = document.createRange(), oe = /* @__PURE__ */ new Map(), de = function(be) {
      return oe.has(be) || oe.set(be, G(be, C)), oe.get(be);
    }, pe = function(be, Me) {
      var x = V.runs[V.runs.length - 1];
      x && x.style === Me ? x.text += be : V.runs.push({ text: be, style: Me });
    }, Se = function(be) {
      if (be.nodeType === 3)
        for (var Me = de(be.parentElement), x = be.data, fe = 0; fe < x.length; ) {
          var ye = x.codePointAt(fe), ve = ye > 65535 ? 2 : 1;
          W.setStart(be, fe), W.setEnd(be, fe + ve);
          var we = W.getClientRects(), ge = x.slice(fe, fe + ve);
          if (we.length) {
            var re = we[0];
            /\s/.test(ge) ? V && pe(" ", Me) : ((!V || re.top + re.height / 2 > V.bottom) && (V = { top: re.top, bottom: re.bottom, runs: [] }, N.push(V)), pe(ge, Me), V.bottom = Math.max(V.bottom, re.bottom));
          }
          fe += ve;
        }
      else if (be.nodeType === 1) {
        if (be.tagName === "BR") {
          V && (V.hardBreakAfter = !0), V = null;
          return;
        }
        for (var Ae = 0; Ae < be.childNodes.length; Ae += 1) Se(be.childNodes[Ae]);
      }
    };
    return Se(P), N.forEach(function(be) {
      be.runs = be.runs.filter(function(Me) {
        return Me.text.length;
      }), delete be.top, delete be.bottom;
    }), N;
  }
  function se(P, C, N) {
    var V = getComputedStyle(P), W = parseFloat(V.fontSize), oe = V.lineHeight === "normal" ? W * 1.32 : parseFloat(V.lineHeight), de = {
      align: V.textAlign === "start" ? "left" : V.textAlign,
      lineHeight: oe,
      lines: Y(P, C),
      endStyle: G(P, C)
    };
    return N && Object.keys(N).forEach(function(pe) {
      de[pe] = N[pe];
    }), de;
  }
  function ue(P, C) {
    var N = getComputedStyle(P), V = { middle: "ctr", bottom: "b" }[N.verticalAlign] || "t";
    return { insets: K(N), anchor: V, paragraphs: C };
  }
  function U(P, C) {
    var N = Array.prototype.filter.call(P.children, function(Se) {
      return Se.tagName === "LI";
    }), V = P.tagName === "OL", W = getComputedStyle(P), oe = P.getBoundingClientRect().left, de = N.map(function(Se, be) {
      var Me = Se.getBoundingClientRect(), x = be > 0 ? N[be - 1].getBoundingClientRect() : null;
      return se(Se, C, {
        bullet: W.listStyleType === "none" ? null : { type: V ? "num" : "char", marL: Me.left - oe },
        spaceBefore: x ? Math.max(0, Me.top - x.bottom) : 0
      });
    }), pe = ue(P, de);
    return pe.insets.l = 0, { type: "text", name: P.tagName.toLowerCase(), path: h(P), box: L(P), text: pe };
  }
  function $(P, C) {
    var N = Array.prototype.slice.call(P.querySelectorAll("tr")), V = Array.prototype.map.call(N[0] ? N[0].children : [], function(W) {
      return W.getBoundingClientRect().width;
    });
    return {
      type: "table",
      name: "table",
      path: h(P),
      box: L(P),
      cols: V,
      rows: N.map(function(W) {
        return {
          h: W.getBoundingClientRect().height,
          cells: Array.prototype.map.call(W.children, function(oe) {
            var de = getComputedStyle(oe), pe = C * Number(de.opacity || 1), Se = parseFloat(de.borderBottomWidth) && de.borderBottomStyle !== "none" ? { w: parseFloat(de.borderBottomWidth), color: I(de.borderBottomColor, pe) } : null, be = B(de, pe) || B(getComputedStyle(W), pe);
            return {
              fill: be,
              borderBottom: Se,
              path: h(oe),
              text: {
                insets: { l: parseFloat(de.paddingLeft), t: parseFloat(de.paddingTop), r: parseFloat(de.paddingRight), b: parseFloat(de.paddingBottom) },
                anchor: { middle: "ctr", bottom: "b" }[de.verticalAlign] || "t",
                paragraphs: [se(oe, pe)]
              }
            };
          })
        };
      })
    };
  }
  function q(P, C, N, V, W, oe, de, pe, Se) {
    if (P === pe && C === Se) return [];
    if (N = Math.abs(N), V = Math.abs(V), !N || !V) return [["C", P, C, pe, Se, pe, Se]];
    var be = W * Math.PI / 180, Me = Math.cos(be), x = Math.sin(be), fe = (P - pe) / 2, ye = (C - Se) / 2, ve = Me * fe + x * ye, we = -x * fe + Me * ye, ge = ve * ve / (N * N) + we * we / (V * V);
    ge > 1 && (N *= Math.sqrt(ge), V *= Math.sqrt(ge));
    var re = N * N * V * V - N * N * we * we - V * V * ve * ve, Ae = N * N * we * we + V * V * ve * ve, je = (oe === de ? -1 : 1) * Math.sqrt(Math.max(0, re / Ae)), Te = je * (N * we) / V, $e = je * -(V * ve) / N, ze = Me * Te - x * $e + (P + pe) / 2, Fe = x * Te + Me * $e + (C + Se) / 2, Pe = function(Dt, yt, Ft, _e) {
      var xe = Math.acos(Math.max(-1, Math.min(1, (Dt * Ft + yt * _e) / (Math.sqrt(Dt * Dt + yt * yt) * Math.sqrt(Ft * Ft + _e * _e)))));
      return Dt * _e - yt * Ft < 0 ? -xe : xe;
    }, ce = Pe(1, 0, (ve - Te) / N, (we - $e) / V), ee = Pe((ve - Te) / N, (we - $e) / V, (-ve - Te) / N, (-we - $e) / V);
    !de && ee > 0 && (ee -= 2 * Math.PI), de && ee < 0 && (ee += 2 * Math.PI);
    for (var te = Math.max(1, Math.ceil(Math.abs(ee) / (Math.PI / 2))), Ne = ee / te, De = 4 / 3 * Math.tan(Ne / 4), Z = function(Dt) {
      var yt = N * Math.cos(Dt), Ft = V * Math.sin(Dt);
      return [ze + Me * yt - x * Ft, Fe + x * yt + Me * Ft];
    }, tt = function(Dt) {
      var yt = -N * Math.sin(Dt), Ft = V * Math.cos(Dt);
      return [Me * yt - x * Ft, x * yt + Me * Ft];
    }, nt = [], Lt = 0; Lt < te; Lt += 1) {
      var mt = ce + Lt * Ne, Ve = mt + Ne, Le = Z(mt), rn = Lt === te - 1 ? [pe, Se] : Z(Ve), rt = tt(mt), pt = tt(Ve);
      nt.push(["C", Le[0] + De * rt[0], Le[1] + De * rt[1], rn[0] - De * pt[0], rn[1] - De * pt[1], rn[0], rn[1]]);
    }
    return nt;
  }
  function H(P) {
    for (var C = [], N = 0, V = "", W = 0, oe = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/; N < P.length; ) {
      var de = P[N];
      if (/[\s,]/.test(de)) {
        N += 1;
        continue;
      }
      if (/[MLHVCSQTZAmlhvcsqtza]/.test(de)) {
        C.push(de), V = de.toUpperCase(), W = 0, N += 1;
        continue;
      }
      if (V === "A" && (W % 7 === 3 || W % 7 === 4) && (de === "0" || de === "1")) {
        C.push(de), N += 1, W += 1;
        continue;
      }
      var pe = P.slice(N).match(oe);
      if (!pe) {
        N += 1;
        continue;
      }
      C.push(pe[0]), N += pe[0].length, W += 1;
    }
    return C;
  }
  function ie(P) {
    for (var C = H(P), N = [], V = 0, W = null, oe = 0, de = 0, pe = 0, Se = 0, be = null, Me = null, x = function() {
      return Number(C[V++]);
    }; V < C.length; ) {
      /[A-Za-z]/.test(C[V]) && (W = C[V++]);
      var fe = W === W.toLowerCase(), ye = W.toUpperCase(), ve = fe ? oe : 0, we = fe ? de : 0, ge, re;
      if (ye === "M")
        oe = x() + ve, de = x() + we, pe = oe, Se = de, N.push(["M", oe, de]), W = fe ? "l" : "L", be = null;
      else if (ye === "L")
        oe = x() + ve, de = x() + we, N.push(["L", oe, de]), be = null;
      else if (ye === "H")
        oe = x() + ve, N.push(["L", oe, de]), be = null;
      else if (ye === "V")
        de = x() + we, N.push(["L", oe, de]), be = null;
      else if (ye === "C")
        ge = [x() + ve, x() + we, x() + ve, x() + we, x() + ve, x() + we], N.push(["C"].concat(ge)), be = [ge[2], ge[3]], oe = ge[4], de = ge[5];
      else if (ye === "S")
        re = be && /[CS]/.test(Me) ? [2 * oe - be[0], 2 * de - be[1]] : [oe, de], ge = [x() + ve, x() + we, x() + ve, x() + we], N.push(["C", re[0], re[1]].concat(ge)), be = [ge[0], ge[1]], oe = ge[2], de = ge[3];
      else if (ye === "Q")
        ge = [x() + ve, x() + we, x() + ve, x() + we], N.push(["Q"].concat(ge)), be = [ge[0], ge[1]], oe = ge[2], de = ge[3];
      else if (ye === "T")
        re = be && /[QT]/.test(Me) ? [2 * oe - be[0], 2 * de - be[1]] : [oe, de], ge = [x() + ve, x() + we], N.push(["Q", re[0], re[1]].concat(ge)), be = re, oe = ge[0], de = ge[1];
      else if (ye === "Z")
        N.push(["Z"]), oe = pe, de = Se, be = null;
      else if (ye === "A") {
        var Ae = x(), je = x(), Te = x(), $e = x(), ze = x(), Fe = x() + ve, Pe = x() + we;
        N.push.apply(N, q(oe, de, Ae, je, Te, $e ? 1 : 0, ze ? 1 : 0, Fe, Pe)), oe = Fe, de = Pe, be = null;
      } else break;
      Me = ye;
    }
    return N;
  }
  function Q(P, C, N) {
    var V = getComputedStyle(P), W = V[C], oe = N * Number(V.opacity || 1) * Number(V[C + "Opacity"] || 1);
    if (!W || W === "none") return null;
    var de = W.match(/url\("?#([^")]+)"?\)/);
    if (de) {
      var pe = document.getElementById(de[1]);
      if (!pe) return null;
      var Se = Array.prototype.map.call(pe.querySelectorAll("stop"), function(ye) {
        var ve = getComputedStyle(ye), we = ye.getAttribute("offset") || "0";
        return { pos: parseFloat(we) * (/%/.test(we) ? 1 : 100), color: I(ve.stopColor, oe * Number(ve.stopOpacity || 1), !0) };
      }).filter(function(ye) {
        return ye.color;
      }), be = function(ye, ve) {
        var we = pe.getAttribute(ye);
        return we == null ? ve : /%/.test(we) ? parseFloat(we) / 100 : Number(we);
      }, Me = be("x2", 1) - be("x1", 0), x = be("y2", 0) - be("y1", 0);
      return { type: "linear", angle: Math.atan2(x, Me) * 180 / Math.PI + 90, stops: Se };
    }
    var fe = I(W, oe);
    return fe ? { type: "solid", color: fe } : null;
  }
  function X(P, C) {
    var N = [], V = P.querySelectorAll("path, rect, circle, ellipse, polygon, polyline");
    return Array.prototype.forEach.call(V, function(W) {
      if (!W.closest("defs")) {
        var oe = W.getScreenCTM(), de = M(), pe = function(Ve, Le) {
          return [oe.a * Ve + oe.c * Le + oe.e - de.left, oe.b * Ve + oe.d * Le + oe.f - de.top];
        }, Se = Math.sqrt(Math.abs(oe.a * oe.d - oe.b * oe.c)), be = Q(W, "fill", C), Me = Q(W, "stroke", C), x = getComputedStyle(W), fe = parseFloat(x.strokeWidth), ye = x.strokeDasharray && x.strokeDasharray !== "none" ? x.strokeDasharray.split(/[\s,]+/).map(parseFloat).filter(function(Ve) {
          return Ve > 0;
        }) : [], ve = Me && Me.type === "solid" ? {
          w: fe * Se,
          color: Me.color,
          dash: ye.length ? ye[0] <= fe * 1.5 ? "dot" : "dash" : "solid",
          cap: x.strokeLinecap === "round" ? "rnd" : x.strokeLinecap === "square" ? "sq" : void 0,
          join: x.strokeLinejoin === "round" ? "round" : x.strokeLinejoin === "bevel" ? "bevel" : void 0
        } : null, we = W.tagName, ge = function(Ve) {
          return Number(W.getAttribute(Ve) || 0);
        };
        if ((we === "rect" || we === "circle" || we === "ellipse") && Math.abs(oe.b) < 1e-6 && Math.abs(oe.c) < 1e-6) {
          var re, Ae, je, Te = 0;
          if (we === "rect")
            re = pe(ge("x"), ge("y")), Ae = ge("width") * oe.a, je = ge("height") * oe.d, Te = ge("rx") * oe.a;
          else {
            var $e = ge(we === "circle" ? "r" : "rx"), ze = ge(we === "circle" ? "r" : "ry");
            re = pe(ge("cx") - $e, ge("cy") - ze), Ae = 2 * $e * oe.a, je = 2 * ze * oe.d;
          }
          N.push({ type: "shape", name: "svg-" + we, path: h(W), geom: we === "rect" ? Te ? "roundRect" : "rect" : "ellipse", radius: Te, box: { x: re[0], y: re[1], w: Ae, h: je, rot: 0 }, fill: be, line: ve, effects: [] });
          return;
        }
        var Fe;
        if (we === "path") Fe = ie(W.getAttribute("d") || "");
        else if (we === "polygon" || we === "polyline") {
          var Pe = (W.getAttribute("points") || "").trim().split(/[\s,]+/).map(Number);
          Fe = [];
          for (var ce = 0; ce + 1 < Pe.length; ce += 2) Fe.push([ce === 0 ? "M" : "L", Pe[ce], Pe[ce + 1]]);
          we === "polygon" && Fe.push(["Z"]);
        } else return;
        var ee = Fe.map(function(Ve) {
          if (Ve[0] === "Z") return Ve;
          for (var Le = [Ve[0]], rn = 1; rn < Ve.length; rn += 2) Le.push.apply(Le, pe(Ve[rn], Ve[rn + 1]));
          return Le;
        }), te = [], Ne = [];
        if (ee.forEach(function(Ve) {
          for (var Le = 1; Le < Ve.length; Le += 2)
            te.push(Ve[Le]), Ne.push(Ve[Le + 1]);
        }), !!te.length) {
          var De = Math.min.apply(null, te), Z = Math.min.apply(null, Ne), tt = { x: De, y: Z, w: Math.max(1, Math.max.apply(null, te) - De), h: Math.max(1, Math.max.apply(null, Ne) - Z), rot: 0 }, nt = [], Lt = null;
          ee.forEach(function(Ve) {
            Ve[0] === "M" ? (Lt = [Ve], nt.push(Lt)) : Lt && Lt.push(Ve);
          });
          var mt = nt.every(function(Ve) {
            return Ve.length <= 2 && Ve.every(function(Le) {
              return Le[0] === "M" || Le[0] === "L";
            });
          });
          N.push({ type: "path", name: "svg-" + we, path: h(W), box: tt, cmds: ee, fill: mt ? null : be, line: ve, closed: ee.some(function(Ve) {
            return Ve[0] === "Z";
          }) });
        }
      }
    }), { type: "group", name: P.getAttribute("aria-label") || "svg", path: h(P), box: L(P), items: N };
  }
  function ne(P, C, N) {
    var V = getComputedStyle(P), W = L(P), oe = A(V, C);
    oe && oe.nonUniform && m("error", P, "边框四边必须一致（单边强调线请用单独的元素）");
    var de = T(V, C);
    return de && de.spread && m("error", P, "box-shadow 不支持 spread"), { type: "shape", name: P.tagName.toLowerCase(), path: h(P), geom: N, radius: R(V), box: W, fill: B(V, C), line: oe && !oe.nonUniform ? oe : null, effects: de ? [de] : [] };
  }
  function le(P, C) {
    var N = getComputedStyle(P);
    if (!(N.display === "none" && P.tagName !== "X-LINE") && !(P.tagName === "ASIDE" || P.hasAttribute("data-deck-preview"))) {
      var V = E(P), W = P.tagName;
      if (P.namespaceURI === d) {
        C.push(X(P, V));
        return;
      }
      if (W === "X-LINE") {
        var oe = function(ge) {
          return Number(P.getAttribute(ge));
        };
        C.push({
          type: "line",
          name: "x-line",
          path: h(P),
          x1: oe("x1"),
          y1: oe("y1"),
          x2: oe("x2"),
          y2: oe("y2"),
          line: { w: Number(P.getAttribute("stroke-width") || 2), color: I(S(P.getAttribute("stroke") || "#000000"), V), dash: P.getAttribute("dash") || "solid", start: P.getAttribute("start") || "none", end: P.getAttribute("end") || "none" }
        });
        return;
      }
      if (W === "IMG") {
        C.push({ type: "pic", name: P.getAttribute("alt") || "image", path: h(P), box: L(P), src: P.getAttribute("src"), fit: N.objectFit, natural: { w: P.naturalWidth, h: P.naturalHeight }, radius: R(N), opacity: V });
        return;
      }
      if (W === "TABLE") {
        C.push($(P, V));
        return;
      }
      if (W === "UL" || W === "OL") {
        k(N) && C.push(ne(P, V, R(N) ? "roundRect" : "rect")), C.push(U(P, V));
        return;
      }
      if (W === "X-SHAPE") {
        var de = P.getAttribute("kind"), pe = ne(P, V, de === "rect" && R(N) ? "roundRect" : de);
        P.textContent.trim() && (pe.text = ue(P, [se(P, V)]), pe.text.anchor = { start: "t", "flex-start": "t", end: "b", "flex-end": "b" }[N.alignItems] || "ctr"), C.push(pe);
        return;
      }
      if (e.has(W)) {
        var Se = se(P, V);
        if (k(N)) {
          var be = ne(P, V, R(N) ? "roundRect" : "rect");
          be.text = ue(P, [Se]), C.push(be);
        } else
          C.push({ type: "text", name: W.toLowerCase(), path: h(P), box: L(P), text: ue(P, [Se]) });
        var Me = K(N), x = P.getBoundingClientRect().height - Me.t - Me.b, fe = Se.lines.length * Se.lineHeight;
        fe > x + 1 && m("error", P, "文字超出盒子 " + Math.round(fe - x) + "px，放不下请拆分或缩短"), parseFloat(N.fontSize) < 20 && m("error", P, "字号 " + N.fontSize + " 小于 20px");
        return;
      }
      if (W === "DIV" || W === "SECTION") {
        for (var ye = [], ve = 0; ve < P.children.length; ve += 1) le(P.children[ve], ye);
        if (W === "DIV" && k(N)) {
          var we = ne(P, V, R(N) ? "roundRect" : "rect");
          if (!ye.length) {
            C.push(we);
            return;
          }
          C.push({ type: "group", name: "card", path: h(P), box: L(P), items: [we].concat(ye) });
          return;
        }
        C.push.apply(C, ye);
        return;
      }
      C.push({ type: "text", name: W.toLowerCase(), path: h(P), box: L(P), text: ue(P, [se(P, V)]) });
    }
  }
  function he(P) {
    var C = document.createRange();
    return C.selectNodeContents(P), Array.prototype.filter.call(C.getClientRects(), function(N) {
      return N.width > 1 && N.height > 1;
    });
  }
  function me(P) {
    var C = "h1,h2,h3,p,li,th,td,x-shape", N = Array.prototype.filter.call(P.querySelectorAll(C), function(ye) {
      return ye.textContent.trim() && !(ye.parentElement && ye.parentElement.closest(C));
    }), V = [];
    N.forEach(function(ye, ve) {
      he(ye).forEach(function(we) {
        V.push({ i: ve, el: ye, r: we });
      });
    });
    for (var W = {}, oe = 0; oe < V.length; oe += 1)
      for (var de = oe + 1; de < V.length; de += 1) {
        var pe = V[oe], Se = V[de];
        if (!(pe.i === Se.i || W[pe.i + ":" + Se.i])) {
          var be = Math.min(pe.r.right, Se.r.right) - Math.max(pe.r.left, Se.r.left), Me = Math.min(pe.r.bottom, Se.r.bottom) - Math.max(pe.r.top, Se.r.top);
          be > 4 && Me > Math.max(4, 0.3 * Math.min(pe.r.height, Se.r.height)) && (W[pe.i + ":" + Se.i] = !0, m("error", Se.el, "文字与 " + h(pe.el) + " 重叠 " + Math.round(Me) + "px，请调整位置、尺寸或拆页"));
        }
      }
    var x = Array.prototype.filter.call(P.querySelectorAll("div"), function(ye) {
      return k(getComputedStyle(ye));
    }), fe = /* @__PURE__ */ new Set();
    x.forEach(function(ye) {
      var ve = ye.getBoundingClientRect(), we = function(ge) {
        return Math.max(ge.right - ve.right, ge.bottom - ve.bottom, ve.left - ge.left, ve.top - ge.top);
      };
      V.forEach(function(ge) {
        if (!(fe.has(ge.el) || ge.el === ye || !ye.contains(ge.el))) {
          var re = we(ge.r);
          re > 2 && (fe.add(ge.el), m("error", ge.el, "文字超出所在卡片 " + Math.round(re) + "px（" + h(ye) + "），请加大卡片、缩短文字或拆页"));
        }
      }), Array.prototype.forEach.call(ye.querySelectorAll("img,svg,table,div,x-shape"), function(ge) {
        if (!(fe.has(ge) || ge.closest("svg") !== null && ge.tagName !== "svg")) {
          var re = getComputedStyle(ge);
          if (!(ge.tagName === "DIV" && !k(re))) {
            var Ae = we(ge.getBoundingClientRect());
            Ae > 2 && (fe.add(ge), m("error", ge, "元素超出所在卡片 " + Math.round(Ae) + "px（" + h(ye) + "）"));
          }
        }
      });
    });
  }
  function Ee() {
    var P = p();
    if (!P) return null;
    for (var C = getComputedStyle(P), N = [], V = 0; V < P.children.length; V += 1) le(P.children[V], N);
    var W = M();
    Array.prototype.forEach.call(P.querySelectorAll("*"), function(de) {
      if (!(de.tagName === "X-LINE" || de.closest("svg") && de.tagName !== "svg")) {
        var pe = de.getBoundingClientRect();
        pe.width && (pe.right > W.right + 1 || pe.bottom > W.bottom + 1 || pe.left < W.left - 1 || pe.top < W.top - 1) && m("warning", de, "元素超出画布");
      }
    }), me(P);
    var oe = P.querySelector(":scope > aside");
    return { id: P.id, background: B(C, 1), items: N, notes: oe ? oe.textContent.trim() : "", elementCount: P.querySelectorAll("*").length + 1 };
  }
  function We() {
    var P = [];
    return document.fonts.forEach(function(C) {
      C.status === "loaded" && P.push(C.family.replace(/["']/g, "") + " " + C.weight);
    }), P;
  }
  var j = {
    triangle: function(P, C) {
      return [[P / 2, 0], [P, C], [0, C]];
    },
    diamond: function(P, C) {
      return [[P / 2, 0], [P, C / 2], [P / 2, C], [0, C / 2]];
    },
    chevron: function(P, C) {
      var N = Math.min(P, C) * 0.5;
      return [[0, 0], [P - N, 0], [P, C / 2], [P - N, C], [0, C], [N, C / 2]];
    },
    homePlate: function(P, C) {
      var N = Math.min(P, C) * 0.5;
      return [[0, 0], [P - N, 0], [P, C / 2], [P - N, C], [0, C]];
    },
    rightArrow: function(P, C) {
      var N = C * 0.5, V = Math.min(P, C) * 0.5;
      return [[0, C / 2 - N / 2], [P - V, C / 2 - N / 2], [P - V, 0], [P, C / 2], [P - V, C], [P - V, C / 2 + N / 2], [0, C / 2 + N / 2]];
    }
  };
  function ke() {
    var P = p();
    if (!(!P || P.hasAttribute("data-deck-painted"))) {
      P.setAttribute("data-deck-painted", ""), Array.prototype.forEach.call(P.querySelectorAll("x-shape"), function(W) {
        var oe = W.getAttribute("kind"), de = getComputedStyle(W);
        if (oe === "ellipse") {
          W.style.borderRadius = "50%";
          return;
        }
        var pe = j[oe];
        if (pe) {
          var Se = W.offsetWidth, be = W.offsetHeight, Me = de.boxShadow, x = document.createElement("div");
          x.style.cssText = "position:absolute;left:0;top:0;width:" + Se + "px;height:" + be + "px;background:" + (de.backgroundImage !== "none" ? de.backgroundImage : de.backgroundColor) + ";clip-path:polygon(" + pe(Se, be).map(function(ve) {
            return ve[0] + "px " + ve[1] + "px";
          }).join(",") + ")";
          var fe = document.createElement("div");
          fe.setAttribute("data-deck-preview", ""), fe.style.cssText = "position:absolute;left:0;top:0;width:" + Se + "px;height:" + be + "px;" + (Me !== "none" && !/inset/.test(Me) ? "filter:drop-shadow(" + Me.replace(/\s0px$/, "") + ")" : ""), fe.appendChild(x), W.style.background = "transparent", W.style.boxShadow = "none", W.style.border = "none", getComputedStyle(W).position === "static" && (W.style.position = "relative");
          var ye = document.createElement("span");
          for (ye.setAttribute("data-deck-preview-text", ""), ye.style.cssText = "position:relative"; W.firstChild; ) ye.appendChild(W.firstChild);
          W.appendChild(fe), W.appendChild(ye);
        }
      });
      var C = Array.prototype.slice.call(P.querySelectorAll("x-line"));
      if (C.length) {
        var N = document.createElementNS(d, "svg");
        N.setAttribute("data-deck-preview", ""), N.setAttribute("width", "1920"), N.setAttribute("height", "1080"), N.style.cssText = "position:absolute;left:0;top:0;pointer-events:none";
        var V = document.createElementNS(d, "defs");
        N.appendChild(V), C.forEach(function(W, oe) {
          var de = W.getAttribute("stroke") || "#000", pe = Number(W.getAttribute("stroke-width") || 2), Se = document.createElementNS(d, "line");
          ["x1", "y1", "x2", "y2"].forEach(function(Me) {
            Se.setAttribute(Me, W.getAttribute(Me));
          }), Se.setAttribute("stroke", de), Se.setAttribute("stroke-width", String(pe));
          var be = W.getAttribute("dash");
          be === "dash" && Se.setAttribute("stroke-dasharray", pe * 4 + " " + pe * 3), be === "dot" && Se.setAttribute("stroke-dasharray", pe + " " + pe * 2), [["end", "marker-end"], ["start", "marker-start"]].forEach(function(Me) {
            var x = W.getAttribute(Me[0]);
            if (!(!x || x === "none")) {
              var fe = "m" + oe + Me[0], ye = document.createElementNS(d, "marker");
              ye.setAttribute("id", fe), ye.setAttribute("markerUnits", "strokeWidth"), ye.setAttribute("markerWidth", "3"), ye.setAttribute("markerHeight", "3"), ye.setAttribute("viewBox", "0 0 10 10"), ye.setAttribute("refX", "5"), ye.setAttribute("refY", "5"), ye.setAttribute("orient", "auto-start-reverse");
              var ve = document.createElementNS(d, x === "oval" ? "circle" : "path");
              x === "oval" ? (ve.setAttribute("cx", "5"), ve.setAttribute("cy", "5"), ve.setAttribute("r", "5")) : ve.setAttribute("d", x === "diamond" ? "M5 0 L10 5 L5 10 L0 5 Z" : "M0 0 L10 5 L0 10 Z"), ve.setAttribute("fill", de), ye.appendChild(ve), V.appendChild(ye), Se.setAttribute(Me[1], "url(#" + fe + ")");
            }
          }), N.appendChild(Se);
        }), P.appendChild(N);
      }
    }
  }
  function O() {
    var P = p();
    if (P) {
      var C = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
      P.style.transformOrigin = "0 0", P.style.transform = "scale(" + C + ")", P.style.position = "absolute", P.style.left = Math.max(0, (window.innerWidth - 1920 * C) / 2) + "px", P.style.top = Math.max(0, (window.innerHeight - 1080 * C) / 2) + "px";
    }
  }
  window.__deck = { validate: w, extract: Ee, applyPreview: ke, fit: O, loadedFonts: We, pathOf: h, parsePathD: ie, diagnostics: f };
}

const FFt = `(${$Ft.toString()})();`;

function LFt(e) {
  return `
html,body{margin:0;padding:0;background:transparent}
section{position:relative;width:1920px;height:1080px;overflow:hidden;box-sizing:border-box;font-family:${JSON.stringify(e)};font-size:28px;line-height:1.4;color:#1A1A1A;text-spacing-trim:space-all}
section *{box-sizing:border-box;margin:0}
h1,h2,h3{font-weight:700}
h1,h2,h3,p,li{line-height:inherit}
ul,ol{padding-left:36px}
table{border-collapse:collapse;border-spacing:0}
th{font-weight:700;text-align:left}
td,th{vertical-align:middle}
x-shape{display:block}
x-line{display:none}
img{display:block}
aside{display:none}
`;
}

const jFt = "html,body{overflow:hidden;width:100%;height:100%;background:transparent}";

function LY(e) {
  return e.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function d_e(e) {
  return `script-src 'nonce-${e}'`;
}

function f_e() {
  return Ot.randomBytes(16).toString("base64url");
}

function p_e(e) {
  const t = l_e(e.font, (s) => s.source.kind === "local" ? $F(s.source.names) : `url(${JSON.stringify(e.fontUrl(s))})`), n = e.mode === "view" ? "window.__deck.applyPreview();window.__deck.fit();window.addEventListener('resize',function(){window.__deck.fit();});if(typeof ResizeObserver!=='undefined'){new ResizeObserver(function(){window.__deck.fit();}).observe(document.documentElement);}" : "", r = e.scriptNonce || f_e();
  return [
    "<!doctype html>",
    '<html><head><meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${d_e(r)}">`,
    `<title>${LY(e.title)}</title>`,
    `<base href="${LY(e.baseHref)}">`,
    `<style>${t}
${LFt(e.font.family)}${e.mode === "view" ? jFt : ""}</style>`,
    `<script nonce="${r}">${FFt}<\/script>`,
    "</head><body>",
    // Slide markup goes in verbatim; anything besides one <section> is reported by validation.
    e.slideSource.trim(),
    n || e.extraScript ? `<script nonce="${r}">${n}${e.extraScript || ""}<\/script>` : "",
    "</body></html>"
  ].join("");
}

const KFt = [
  {
    font: "Microsoft YaHei",
    sizes: [24, 28, 40, 60, 96, 120],
    lineHeights: [1, 1.1, 1.2, 1.32, 1.5, 1.75, 2],
    deltaPx: {
      24: { 1: -3, 1.1: -2, 1.2: -1, 1.32: 0, 1.5: 1, 1.75: 2, 2: 4 },
      28: { 1: -3, 1.1: -1, 1.2: -1, 1.32: -1, 1.5: 0, 1.75: 3, 2: 3 },
      40: { 1: -6, 1.1: -4, 1.2: -1, 1.32: -2, 1.5: 0, 1.75: 1, 2: 5 },
      60: { 1: -7, 1.1: -4, 1.2: -1, 1.32: -2, 1.5: 0, 1.75: 4, 2: 7 },
      96: { 1: -11, 1.1: -6, 1.2: -8, 1.32: -7, 1.5: -1, 1.75: 4, 2: 11 },
      120: { 1: -16, 1.1: -10, 1.2: -4, 1.32: -9, 1.5: -2, 1.75: 6, 2: 13 }
    }
  },
  {
    font: "Source Han Sans SC",
    sizes: [24, 28, 40, 60, 96, 120],
    lineHeights: [1, 1.1, 1.2, 1.32, 1.5, 1.75, 2],
    deltaPx: {
      24: { 1: -4, 1.1: -3, 1.2: -2, 1.32: -1, 1.5: 0, 1.75: 1, 2: 3 },
      28: { 1: -4, 1.1: -2, 1.2: -1, 1.32: -2, 1.5: -1, 1.75: 3, 2: 2 },
      40: { 1: -7, 1.1: -5, 1.2: -2, 1.32: -3, 1.5: -1, 1.75: 0, 2: 4 },
      60: { 1: -10, 1.1: -7, 1.2: -4, 1.32: -5, 1.5: -3, 1.75: 1, 2: 4 },
      96: { 1: -14, 1.1: -9, 1.2: -11, 1.32: -10, 1.5: -4, 1.75: 1, 2: 8 },
      120: { 1: -20, 1.1: -14, 1.2: -8, 1.32: -13, 1.5: -6, 1.75: 2, 2: 9 }
    }
  }
];

const UY = { a: 0.2198, b: -0.3327 };

function BY(e, t) {
  const n = [...e].sort((s, i) => s - i);
  if (t <= n[0]) return [n[0], n[0], 0];
  if (t >= n[n.length - 1]) return [n[n.length - 1], n[n.length - 1], 0];
  const r = n.findIndex((s) => s >= t);
  return [n[r - 1], n[r], (t - n[r - 1]) / (n[r] - n[r - 1])];
}

function WFt(e, t, n, r = KFt) {
  const s = r.find((m) => m.font === e);
  if (!s) return UY.a * n + UY.b * t;
  const i = n / t, [o, a, c] = BY(s.sizes, t), [l, u, d] = BY(s.lineHeights, i), f = (m, g) => s.deltaPx[String(m)]?.[String(g)] ?? 0, p = f(o, l) * (1 - d) + f(o, u) * d, h = f(a, l) * (1 - d) + f(a, u) * d;
  return p * (1 - c) + h * c;
}

const GFt = 6350;

const Gt = (e) => Math.round(e * GFt);

const lf = (e) => e.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const mh = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

const Ti = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
`;

const ni = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function ql(e) {
  const t = e.a < 1 ? `<a:alpha val="${Math.round(e.a * 1e5)}"/>` : "";
  return `<a:srgbClr val="${e.hex}">${t}</a:srgbClr>`;
}

function qY(e) {
  return `<a:gsLst>${e.map((t) => `<a:gs pos="${Math.round(Math.min(100, Math.max(0, t.pos)) * 1e3)}">${ql(t.color)}</a:gs>`).join("")}</a:gsLst>`;
}

function MI(e) {
  if (!e) return "<a:noFill/>";
  if (e.type === "solid") return `<a:solidFill>${ql(e.color)}</a:solidFill>`;
  if (e.stops.length < 2) return e.stops[0] ? `<a:solidFill>${ql(e.stops[0].color)}</a:solidFill>` : "<a:noFill/>";
  if (e.type === "linear") {
    const r = ((e.angle - 90) % 360 + 360) % 360;
    return `<a:gradFill rotWithShape="1">${qY(e.stops)}<a:lin ang="${Math.round(r * 6e4)}" scaled="0"/></a:gradFill>`;
  }
  const { x: t, y: n } = e.center;
  return `<a:gradFill rotWithShape="1">${qY(e.stops)}<a:path path="circle"><a:fillToRect l="${Math.round(t * 1e3)}" t="${Math.round(n * 1e3)}" r="${Math.round((100 - t) * 1e3)}" b="${Math.round((100 - n) * 1e3)}"/></a:path></a:gradFill>`;
}

const VFt = { solid: "solid", dashed: "dash", dash: "dash", dotted: "sysDot", dot: "sysDot" };

function OM(e) {
  if (!e || !e.color) return "<a:ln><a:noFill/></a:ln>";
  const t = (r, s) => s && s !== "none" ? `<a:${r} type="${s}" w="med" len="med"/>` : "", n = e.join ? `<a:${e.join}/>` : "";
  return `<a:ln w="${Gt(e.w)}"${e.cap ? ` cap="${e.cap}"` : ""}><a:solidFill>${ql(e.color)}</a:solidFill><a:prstDash val="${VFt[e.dash || "solid"] || "solid"}"/>${n}${t("headEnd", e.start)}${t("tailEnd", e.end)}</a:ln>`;
}

function JFt(e) {
  if (!e.length) return "";
  const t = (n) => {
    if (!n.color) return "";
    const r = Gt(Math.hypot(n.x, n.y)), s = Math.round((Math.atan2(n.y, n.x) * 180 / Math.PI + 360) % 360 * 6e4);
    return n.inset ? `<a:innerShdw blurRad="${Gt(n.blur)}" dist="${r}" dir="${s}">${ql(n.color)}</a:innerShdw>` : `<a:outerShdw blurRad="${Gt(n.blur)}" dist="${r}" dir="${s}" algn="ctr" rotWithShape="0">${ql(n.color)}</a:outerShdw>`;
  };
  return `<a:effectLst>${[...e].sort((n, r) => Number(r.inset) - Number(n.inset)).map(t).join("")}</a:effectLst>`;
}

function Cg(e, t = "") {
  return `<a:xfrm${e.rot ? ` rot="${Math.round(e.rot * 6e4)}"` : ""}${t}><a:off x="${Gt(e.x)}" y="${Gt(e.y)}"/><a:ext cx="${Math.max(1, Gt(e.w))}" cy="${Math.max(1, Gt(e.h))}"/></a:xfrm>`;
}

function zY(e, t, n = 0) {
  let r = "";
  return e === "roundRect" && (r = `<a:gd name="adj" fmla="val ${Math.min(5e4, Math.round(n / Math.max(1, Math.min(t.w, t.h)) * 1e5))}"/>`), `<a:prstGeom prst="${e}"><a:avLst>${r}</a:avLst></a:prstGeom>`;
}

const YFt = { left: "l", center: "ctr", right: "r", justify: "just", start: "l", end: "r" };

function MU(e, t = "a:rPr") {
  const n = ['lang="zh-CN"', 'altLang="en-US"', `sz="${Math.round(e.size * 50)}"`, `b="${e.bold ? 1 : 0}"`, `i="${e.italic ? 1 : 0}"`];
  e.underline && n.push('u="sng"'), e.spacing && n.push(`spc="${Math.round(e.spacing * 50)}"`), n.push('dirty="0"');
  const r = e.color ? `<a:solidFill>${ql(e.color)}</a:solidFill>` : "", s = lf(e.font);
  return `<${t} ${n.join(" ")}>${r}<a:latin typeface="${s}"/><a:ea typeface="${s}"/><a:cs typeface="${s}"/></${t}>`;
}

const XFt = (e) => `<a:r>${MU(e.style)}<a:t>${lf(e.text)}</a:t></a:r>`;

const ZFt = (e) => `<a:br>${MU(e)}</a:br>`;

function QFt(e, t) {
  const n = e.bullet ? e.bullet.type === "num" ? '<a:buFont typeface="+mj-lt"/><a:buAutoNum type="arabicPeriod"/>' : '<a:buFont typeface="Arial"/><a:buChar char="&#8226;"/>' : "<a:buNone/>", r = e.bullet ? ` marL="${Gt(e.bullet.marL)}" indent="${-Gt(e.bullet.marL)}"` : ' marL="0" indent="0"', s = `<a:pPr algn="${YFt[e.align] || "l"}"${r} hangingPunct="0"><a:lnSpc><a:spcPts val="${Math.round(e.lineHeight * 50)}"/></a:lnSpc><a:spcBef><a:spcPts val="${Math.round((e.spaceBefore || 0) * 50)}"/></a:spcBef>${n}</a:pPr>`, i = [];
  return e.lines.forEach((o, a) => {
    const c = o.runs.map((d) => ({ ...d })), l = a === e.lines.length - 1, u = !l && !o.hardBreakAfter;
    if (t === "baked" || !u) {
      const d = c[c.length - 1];
      d && (d.text = d.text.replace(/\s+$/, ""));
    }
    a === 0 && c[0] && (c[0].text = c[0].text.replace(/^\s+/, "")), i.push(c.filter((d) => d.text).map(XFt).join("")), !l && (o.hardBreakAfter || t === "baked") && i.push(ZFt(c[c.length - 1]?.style || e.endStyle));
  }), `<a:p>${s}${i.join("")}${MU(e.endStyle, "a:endParaRPr")}</a:p>`;
}

function DM(e) {
  const t = e.paragraphs[0];
  if (!t) return 0;
  const n = Math.max(t.endStyle.size, ...t.lines.flatMap((r) => r.runs.map((s) => s.style.size)));
  return WFt(t.endStyle.font, n, t.lineHeight);
}

function NM(e, t, n = "p:txBody", r = 0) {
  const s = t === "auto" ? e.paragraphs.every((c) => c.lines.length <= 1) ? "baked" : "wrap" : t, i = { ...e.insets, t: e.insets.t - r, b: e.insets.b + r }, a = `<a:bodyPr wrap="${s === "baked" ? "none" : "square"}" lIns="${Gt(i.l)}" tIns="${Gt(i.t)}" rIns="${Gt(i.r)}" bIns="${Gt(i.b)}" anchor="${e.anchor}" rtlCol="0"><a:noAutofit/></a:bodyPr>`;
  return `<${n}>${a}<a:lstStyle/>${e.paragraphs.map((c) => QFt(c, s)).join("")}</${n}>`;
}

const eLt = /* @__PURE__ */ new Set(["rect", "roundRect"]);

const h_e = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif" };

function Rg(e, t, n, r = "") {
  const s = e.nextId++;
  return `<p:nv${t}Pr><p:cNvPr id="${s}" name="${lf(n)} ${s}"/><p:cNv${t}Pr${r}/><p:nvPr/></p:nv${t}Pr>`;
}

function tLt(e, t) {
  if (!t) return e;
  const n = t.w / 2;
  return { ...e, x: e.x + n, y: e.y + n, w: e.w - t.w, h: e.h - t.w };
}

function nLt(e) {
  const { box: t } = e, n = (c, l) => `<a:pt x="${Gt(c - t.x)}" y="${Gt(l - t.y)}"/>`, r = (c) => {
    const l = c.slice(1);
    return c[0] === "M" ? `<a:moveTo>${n(l[0], l[1])}</a:moveTo>` : c[0] === "L" ? `<a:lnTo>${n(l[0], l[1])}</a:lnTo>` : c[0] === "C" ? `<a:cubicBezTo>${n(l[0], l[1])}${n(l[2], l[3])}${n(l[4], l[5])}</a:cubicBezTo>` : c[0] === "Q" ? `<a:quadBezTo>${n(l[0], l[1])}${n(l[2], l[3])}</a:quadBezTo>` : "<a:close/>";
  }, s = [];
  for (const c of e.cmds)
    (c[0] === "M" || !s.length) && s.push([]), s[s.length - 1].push(c);
  const i = e.fill ? "" : ' fill="none"', o = `w="${Math.max(1, Gt(t.w))}" h="${Math.max(1, Gt(t.h))}"`;
  return `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/><a:pathLst>${s.map((c) => `<a:path ${o}${i}>${c.map(r).join("")}</a:path>`).join("")}</a:pathLst></a:custGeom>`;
}

function m_e(e) {
  if (e.type === "line") return { x: Math.min(e.x1, e.x2), y: Math.min(e.y1, e.y2), w: Math.abs(e.x2 - e.x1), h: Math.abs(e.y2 - e.y1) };
  if (e.type === "group") {
    if (!e.items.length) return e.box;
    const t = e.items.map(m_e), n = Math.min(...t.map((s) => s.x)), r = Math.min(...t.map((s) => s.y));
    return { x: n, y: r, w: Math.max(...t.map((s) => s.x + s.w)) - n, h: Math.max(...t.map((s) => s.y + s.h)) - r };
  }
  return e.box;
}

function g_e(e, t) {
  if (!t || !t.startsWith("assets/") || t.includes("\\") || t.includes("..")) return null;
  const n = z.resolve(e, t), r = z.resolve(e);
  if (!n.startsWith(r + z.sep)) return null;
  try {
    const s = J.realpathSync(n), i = J.realpathSync(r);
    return s.startsWith(i + z.sep) && J.statSync(s).isFile() ? s : null;
  } catch {
    return null;
  }
}

function FF(e, t) {
  switch (e.type) {
    case "shape": {
      const n = tLt(e.box, e.line), r = e.text && eLt.has(e.geom), s = r ? NM(e.text, t.mode, "p:txBody", DM(e.text)) : "", i = `<p:sp>${Rg(t, "Sp", e.name)}<p:spPr>${Cg(n)}${zY(e.geom, n, e.radius)}${MI(e.fill)}${OM(e.line)}${JFt(e.effects)}</p:spPr>${s}</p:sp>`;
      return !e.text || r ? i : FF({ type: "group", name: e.name, box: e.box, items: [{ ...e, text: void 0 }, { type: "text", name: `${e.name}-text`, box: e.box, text: e.text }] }, t);
    }
    case "text": {
      const n = { ...e.box, y: e.box.y - DM(e.text) };
      return `<p:sp>${Rg(t, "Sp", e.name, ' txBox="1"')}<p:spPr>${Cg(n)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>${NM(e.text, t.mode)}</p:sp>`;
    }
    case "pic": {
      const n = g_e(t.deckDir, e.src), r = n ? z.extname(n).slice(1).toLowerCase() : "";
      if (!n || !h_e[r])
        return t.warnings.push(`图片无法导出：${e.src}`), "";
      const s = `rId${100 + t.media.length}`, i = `image${t.mediaIndex.n++}.${r === "jpeg" ? "jpg" : r}`;
      t.media.push({ rId: s, part: i, data: J.readFileSync(n), ext: r === "jpeg" ? "jpg" : r });
      let o = e.box, a = "";
      const { w: c, h: l } = e.natural;
      if (e.fit === "cover" && c && l) {
        const d = Math.max(o.w / c, o.h / l), f = (c - o.w / d) / 2 / c * 1e5, p = (l - o.h / d) / 2 / l * 1e5;
        a = `<a:srcRect l="${Math.round(f)}" t="${Math.round(p)}" r="${Math.round(f)}" b="${Math.round(p)}"/>`;
      } else if (e.fit === "contain" && c && l) {
        const d = Math.min(o.w / c, o.h / l), f = c * d, p = l * d;
        o = { ...o, x: o.x + (o.w - f) / 2, y: o.y + (o.h - p) / 2, w: f, h: p };
      }
      const u = e.opacity < 1 ? `<a:alphaModFix amt="${Math.round(e.opacity * 1e5)}"/>` : "";
      return `<p:pic>${Rg(t, "Pic", e.name)}<p:blipFill><a:blip r:embed="${s}">${u}</a:blip>${a}<a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${Cg(o)}${zY(e.radius ? "roundRect" : "rect", o, e.radius)}</p:spPr></p:pic>`;
    }
    case "line": {
      const n = { x: Math.min(e.x1, e.x2), y: Math.min(e.y1, e.y2), w: Math.abs(e.x2 - e.x1), h: Math.abs(e.y2 - e.y1) }, r = `${e.x2 < e.x1 ? ' flipH="1"' : ""}${e.y2 < e.y1 ? ' flipV="1"' : ""}`;
      return `<p:cxnSp>${Rg(t, "CxnSp", e.name)}<p:spPr>${Cg(n, r)}<a:prstGeom prst="line"><a:avLst/></a:prstGeom>${OM(e.line)}</p:spPr></p:cxnSp>`;
    }
    case "path":
      return `<p:sp>${Rg(t, "Sp", e.name)}<p:spPr>${Cg(e.box)}${nLt(e)}${MI(e.fill)}${OM(e.line)}</p:spPr></p:sp>`;
    case "table": {
      if (!e.cols.length) return "";
      const n = (a) => `<a:${a} w="0"><a:noFill/></a:${a}>`, r = e.cols.reduce((a, c) => a + c, 0), s = e.cols.map((a) => `<a:gridCol w="${Gt(a)}"/>`).join(""), i = e.rows.map((a) => `<a:tr h="${Gt(a.h)}">${a.cells.map((c) => {
        const l = c.text.insets, u = DM(c.text), d = c.borderBottom && c.borderBottom.color ? `<a:lnB w="${Gt(c.borderBottom.w)}"><a:solidFill>${ql(c.borderBottom.color)}</a:solidFill><a:prstDash val="solid"/></a:lnB>` : n("lnB");
        return `<a:tc>${NM({ ...c.text, insets: { l: 0, t: 0, r: 0, b: 0 } }, t.mode, "a:txBody").replace(/ (?:lIns|rIns|tIns|bIns|anchor)="[^"]*"/g, "")}<a:tcPr marL="${Gt(l.l)}" marR="${Gt(l.r)}" marT="${Gt(Math.max(0, l.t - u))}" marB="${Gt(Math.max(0, l.b + u))}" anchor="${c.text.anchor}">${n("lnL")}${n("lnR")}${n("lnT")}${d}${MI(c.fill)}</a:tcPr></a:tc>`;
      }).join("")}</a:tr>`).join(""), o = t.nextId++;
      return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${o}" name="Table ${o}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${Gt(e.box.x)}" y="${Gt(e.box.y)}"/><a:ext cx="${Gt(r)}" cy="${Gt(e.box.h)}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr/><a:tblGrid>${s}</a:tblGrid>${i}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
    }
    case "group": {
      if (!e.items.length) return "";
      const n = m_e(e), r = `<a:off x="${Gt(n.x)}" y="${Gt(n.y)}"/><a:ext cx="${Math.max(1, Gt(n.w))}" cy="${Math.max(1, Gt(n.h))}"/>`, s = t.nextId++, i = e.items.map((o) => FF(o, t)).join("");
      return `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${s}" name="${lf(e.name)} ${s}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm>${r}<a:chOff x="${Gt(n.x)}" y="${Gt(n.y)}"/><a:chExt cx="${Math.max(1, Gt(n.w))}" cy="${Math.max(1, Gt(n.h))}"/></a:xfrm></p:grpSpPr>${i}</p:grpSp>`;
    }
    default:
      return "";
  }
}

const OU = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';

function rLt(e, t) {
  const n = e.background ? `<p:bg><p:bgPr>${MI(e.background)}<a:effectLst/></p:bgPr></p:bg>` : "", r = e.items.map((s) => FF(s, t)).join("");
  return `${Ti}<p:sld ${mh}><p:cSld name="${lf(e.id)}">${n}<p:spTree>${OU}${r}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

function sLt(e) {
  const t = lf(e), n = `<a:latin typeface="${t}"/><a:ea typeface="${t}"/><a:cs typeface="${t}"/>`, r = (i) => i + i + i, s = ["1F3A5F", "C2562F", "F2A65A", "3E6B8F", "7A858F", "1B7A3A"].map((i, o) => `<a:accent${o + 1}><a:srgbClr val="${i}"/></a:accent${o + 1}>`).join("");
  return `${Ti}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="SUPER ADC"><a:themeElements><a:clrScheme name="SUPER ADC"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F2A30"/></a:dk2><a:lt2><a:srgbClr val="F4F6F8"/></a:lt2>${s}<a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="SUPER ADC"><a:majorFont>${n}</a:majorFont><a:minorFont>${n}</a:minorFont></a:fontScheme><a:fmtScheme name="SUPER ADC"><a:fillStyleLst>${r('<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>')}</a:fillStyleLst><a:lnStyleLst>${r('<a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>')}</a:lnStyleLst><a:effectStyleLst>${r("<a:effectStyle><a:effectLst/></a:effectStyle>")}</a:effectStyleLst><a:bgFillStyleLst>${r('<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>')}</a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`;
}

const iLt = `${Ti}<p:sldMaster ${mh}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${OU}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="4400"/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="2800"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>`;

const oLt = `${Ti}<p:sldLayout ${mh} type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>${OU}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;

const Mg = (e) => `${Ti}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${e.map(([t, n, r]) => `<Relationship Id="${t}" Type="${n}" Target="${r}"/>`).join("")}</Relationships>`;

async function aLt(e, t) {
  const n = new QE(), r = t.mode || "auto", s = [], i = { n: 1 }, o = /* @__PURE__ */ new Set();
  e.forEach((u, d) => {
    const f = { nextId: 2, mode: r, media: [], deckDir: t.deckDir, mediaIndex: i, warnings: s };
    n.file(`ppt/slides/slide${d + 1}.xml`, rLt(u, f));
    const p = [["rId1", `${ni}/slideLayout`, "../slideLayouts/slideLayout1.xml"]];
    for (const h of f.media)
      p.push([h.rId, `${ni}/image`, `../media/${h.part}`]), n.file(`ppt/media/${h.part}`, h.data), o.add(h.ext);
    n.file(`ppt/slides/_rels/slide${d + 1}.xml.rels`, Mg(p));
  });
  const a = e.length, c = (t.now || /* @__PURE__ */ new Date()).toISOString().replace(/\.\d{3}Z$/, "Z");
  return n.file("[Content_Types].xml", `${Ti}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>` + [...o].map((u) => `<Default Extension="${u}" ContentType="${h_e[u]}"/>`).join("") + '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/><Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/><Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' + Array.from({ length: a }, (u, d) => `<Override PartName="/ppt/slides/slide${d + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("") + "</Types>"), n.file("_rels/.rels", Mg([
    ["rId1", `${ni}/officeDocument`, "ppt/presentation.xml"],
    ["rId2", "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties", "docProps/core.xml"],
    ["rId3", `${ni}/extended-properties`, "docProps/app.xml"]
  ])), n.file("docProps/core.xml", `${Ti}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${lf(t.title)}</dc:title><dc:creator>SUPER ADC</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${c}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${c}</dcterms:modified></cp:coreProperties>`), n.file("docProps/app.xml", `${Ti}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>SUPER ADC</Application><Slides>${a}</Slides></Properties>`), n.file("ppt/presentation.xml", `${Ti}<p:presentation ${mh} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${Array.from({ length: a }, (u, d) => `<p:sldId id="${256 + d}" r:id="rId${10 + d}"/>`).join("")}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`), n.file("ppt/_rels/presentation.xml.rels", Mg([
    ["rId1", `${ni}/slideMaster`, "slideMasters/slideMaster1.xml"],
    ["rId2", `${ni}/theme`, "theme/theme1.xml"],
    ["rId3", `${ni}/presProps`, "presProps.xml"],
    ["rId4", `${ni}/viewProps`, "viewProps.xml"],
    ["rId5", `${ni}/tableStyles`, "tableStyles.xml"],
    ...Array.from({ length: a }, (u, d) => [`rId${10 + d}`, `${ni}/slide`, `slides/slide${d + 1}.xml`])
  ])), n.file("ppt/presProps.xml", `${Ti}<p:presentationPr ${mh}/>`), n.file("ppt/viewProps.xml", `${Ti}<p:viewPr ${mh}/>`), n.file("ppt/tableStyles.xml", `${Ti}<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`), n.file("ppt/theme/theme1.xml", sLt(t.font)), n.file("ppt/slideMasters/slideMaster1.xml", iLt), n.file("ppt/slideMasters/_rels/slideMaster1.xml.rels", Mg([["rId1", `${ni}/slideLayout`, "../slideLayouts/slideLayout1.xml"], ["rId2", `${ni}/theme`, "../theme/theme1.xml"]])), n.file("ppt/slideLayouts/slideLayout1.xml", oLt), n.file("ppt/slideLayouts/_rels/slideLayout1.xml.rels", Mg([["rId1", `${ni}/slideMaster`, "../slideMasters/slideMaster1.xml"]])), { buffer: await n.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }), warnings: s };
}

function hLt(e) {
  return (Array.from(e).map((n) => n.charCodeAt(0) < 32 ? "-" : n).join("").replace(/[\\/:*?"<>|]+/g, "-").trim() || "演示文稿").slice(0, 80);
}

function mLt(e = /* @__PURE__ */ new Date()) {
  const t = (n) => String(n).padStart(2, "0");
  return `${e.getFullYear()}${t(e.getMonth() + 1)}${t(e.getDate())}-${t(e.getHours())}${t(e.getMinutes())}${t(e.getSeconds())}`;
}

function y_e(e, t, n = /* @__PURE__ */ new Date()) {
  const r = z.join(e, "exports"), s = `${hLt(t)}-${mLt(n)}`;
  let i = z.join(r, `${s}.pptx`);
  for (let o = 2; J.existsSync(i); o += 1) i = z.join(r, `${s}-${o}.pptx`);
  return i;
}

export { Um as readDeck, p_e as wrapSlide, u_e as resolveFont, aLt as writePptx, y_e as uniqueExportPath };
