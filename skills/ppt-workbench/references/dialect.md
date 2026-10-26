# 页面方言与布局

项目：`super-adc-deck.json`、`slides/<id>.html`、`assets/`、`notes/`、`exports/`。
清单：`{"v":0,"title":"标题","order":["cover","plan"]}`。id 为 1–64 个英文字母、数字、下划线或连字符。可指定 `fonts:["Microsoft YaHei"]`；默认 Windows 为微软雅黑。目标字体必须实际加载成功。

每页 HTML 恰好一个 `<section id="页ID" style="…">…</section>`。不写完整网页外壳。1920×1080 px，1 px = 0.5 pt，所有长度采用 px（grid 可用 fr；line-height 可用无单位数值）。默认内边距可用 128px，内容区 1664×824。

## 元素

- section：必须提供 background；布局支持 flex/grid/block、方向、gap、对齐、padding。
- div：卡片与布局容器；带背景/边框的 div 会导出为形状，与子对象分组。
- h1/h2/h3/p、ul/ol/li：文字；行内支持 b/strong/i/em/u/span/a/br。支持 font-size、font-weight 400/700、font-style、color、line-height、letter-spacing、text-align。最小 20px；正文通常 28–36px，标题通常 60–80px。字号按实际观看场景选择。
- x-shape：kind 为 rect、roundRect、ellipse、triangle、diamond、chevron、homePlate、rightArrow，内部只能是行内文字。
- x-line：x1/y1/x2/y2 为绝对画布坐标；stroke、stroke-width、dash，start/end 可用 none、triangle、stealth、arrow、oval、diamond。
- img：src 必须为 assets/ 下相对路径，PNG/JPG/GIF。width/height 明确，object-fit:cover 或 contain，禁止拉伸图片。
- table/tr/th/td：原生表格；不支持合并单元格。单元格可设背景、字号、padding、border-bottom、水平/垂直对齐。
- svg：支持 path、rect、circle、ellipse、polygon、polyline、g（translate）、defs/linearGradient/stop。支持基本填充、描边、透明度与渐变。svg 内不放 text，图表标签用 HTML 文字。简单路径导出为原生可编辑形状。

## 样式范围

支持纯色、线性渐变及有限径向渐变；统一边框；单值 border-radius；单层 box-shadow（spread=0）；opacity。支持 flex/grid、固定尺寸、padding、绝对定位 left/top/right/bottom。rotate 只用于定位元素。

不支持 style 标签、class、margin、z-index、overflow、filter、mask、clip-path、mix-blend-mode、text-shadow、脚本、外部网络资源、动画。后面的兄弟元素覆盖前面的。最多 200 元素、15 层嵌套。

没有讲稿备注、动画或数据绑定图表导出；有这类要求时选择相应原 PPT 编辑工具。图表可用 SVG 与 HTML 标签表达，数据必须来自用户或标注为示例。

## 排版习惯

一套稿保持统一色盘、4–5 档字阶和标题位置。每页集中表达一个信息，长段落按内容关系拆为卡片、步骤、表格或分点。先计算竖向空间，文字高度约为字号×行高×行数；实际尺寸由 check 测量。文字不要固定为容不下内容的高度，内容过多优先编辑文案或拆页。

复杂流程图先确定网格再固定坐标。所有页面要做程序检查；视觉检查聚焦首次布局、用户反馈和实际变化。缓存只复用字节内容、资源、字体和浏览器版本均未改变的测量。

## 示例

```html
<section id="plan" style="background:#101820;color:#FFFFFF;padding:128px;display:flex;flex-direction:column;gap:48px">
  <h1 style="font-size:72px">三步完成项目交付</h1>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:32px">
    <div style="background:#243447;border-radius:24px;padding:36px;display:flex;flex-direction:column;gap:20px">
      <h2 style="font-size:48px">明确目标</h2>
      <p style="font-size:32px;line-height:1.5">确定受众、信息重点和需要支持的决定。</p>
    </div>
    <div style="background:#243447;border-radius:24px;padding:36px;display:flex;flex-direction:column;gap:20px">
      <h2 style="font-size:48px">组织内容</h2>
      <p style="font-size:32px;line-height:1.5">将证据和建议安排成清晰的叙述顺序。</p>
    </div>
    <div style="background:#243447;border-radius:24px;padding:36px;display:flex;flex-direction:column;gap:20px">
      <h2 style="font-size:48px">检查交付</h2>
      <p style="font-size:32px;line-height:1.5">检查文字、版式、数据和文件可编辑性。</p>
    </div>
  </div>
</section>
```
