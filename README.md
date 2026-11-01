# 杀戮尖塔 2 图鉴 · STS2 Wiki

把 [游民星空《杀戮尖塔2》图鉴](https://www.gamersky.com/tools/sts2wiki/) 的数据抓取到本地，
用一个零依赖的静态网站展示：**卡牌 580 · 遗物 296 · 敌人 107 · 角色 5**，
含胜率 / 选取率 / 跳过率 / 升级率等实战统计与排名。

## 功能

- 四大图鉴：卡牌、遗物、敌人、角色
- 搜索（中文名 / 英文名）、多维筛选（角色 / 稀有度 / 类别 / 强度 / 敌人类型）、多口径排序（胜率、选取率、交战数…）
- 点击任意条目查看详情：卡图、效果与升级效果、费用、流派、完整统计与排名
- 📱💻 响应式布局，移动端与桌面端自适应
- 🌙☀️ 深色 / 亮色模式：手动切换并记住选择，默认跟随系统

## 快速开始

```bash
git clone https://github.com/TuTouPower/sts2-wiki.git
cd sts2-wiki/site
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

也可以直接双击 `site/index.html` 打开（数据以内嵌脚本方式加载，无需服务器）。

## 重新抓取最新数据

图鉴数据来自游民星空图鉴前端调用的公开接口，爬虫会依次抓取
列表 → 详情（卡牌描述/费用、敌人特殊机制等）→ 图片（卡图自动压缩为 WebP），
并重新生成 `data/*.json` 与 `site/data.js`：

```bash
pip install Pillow        # 仅图片压缩需要
python3 scraper/scrape.py                 # 全量抓取
python3 scraper/scrape.py --no-images     # 只更新数据，不下图片
python3 scraper/scrape.py --no-details    # 只抓列表（快，但无描述）
```

## 目录结构

```
├── scraper/scrape.py   # 爬虫（仅用 Python 标准库 + Pillow）
├── data/               # 结构化数据 JSON（列表与详情合并后的全量数据）
└── site/               # 展示网站（原生 HTML/CSS/JS，零构建）
    ├── index.html
    ├── css/style.css   # 含深/亮双主题变量
    ├── js/app.js
    ├── data.js         # 由爬虫生成，网站实际加载的数据
    └── assets/img/     # 卡图(WebP) / 遗物图 / Boss 图
```

## 说明

- 数据版权与统计口径归游民星空所有，游戏《Slay the Spire 2》版权归 Mega Crit 所有；本项目为非官方粉丝作品，仅供学习与查阅。
- 源站个别条目为其内部测试数据（如 `DEPRECATED_CARD`），无描述与图片，属正常现象，页面会以占位图展示。
