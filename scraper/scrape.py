#!/usr/bin/env python3
"""抓取游民星空《杀戮尖塔2》图鉴数据（卡牌 / 遗物 / 敌人 / 角色）。

数据来源（游民星空图鉴前端实际调用的公开接口）：
  列表: GET https://router4.gamersky.com/@tools-storage/tools/sp2/stats/global/stat?dataType=<卡牌|遗物|敌人|角色>
  详情: GET https://router4.gamersky.com/@tools-storage/tools/sp2/stats/detail?dataType=<cards|relics|enemies>&en_name=<enName>
图片 CDN: https://image.gamersky.com/webimg13/db/sts2wiki/{card|relic|boss}/<enName>.png

产物：
  data/cards.json / relics.json / enemies.json / characters.json  —— 结构化原始+合并数据
  site/data.js                                                    —— 网站直接加载的数据（window.STS2_DATA）
  site/assets/img/...                                             —— 卡图(转 WebP 压缩) / 遗物图 / Boss 图

用法：
  python3 scrape.py                # 全量：列表 + 详情 + 图片
  python3 scrape.py --no-images    # 只抓数据，不下图片
  python3 scrape.py --no-details   # 只抓列表（快，但卡牌无描述/费用）
依赖：Pillow（仅图片压缩用；无 Pillow 时自动跳过图片）。
"""

import argparse
import io
import json
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
SITE_DIR = ROOT / "site"
IMG_DIR = SITE_DIR / "assets" / "img"

API_BASE = "https://router4.gamersky.com/@tools-storage/tools/sp2/stats"
IMG_BASE = "https://image.gamersky.com/webimg13/db/sts2wiki"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"}

LIST_TYPES = {"卡牌": "cards", "遗物": "relics", "敌人": "enemies", "角色": "characters"}
TEST_ENNAMES = {"DEPRECATED_CARD", "T"}  # 源站内部测试条目，非真实游戏内容
# 角色筛选头像：源站以中文名存于 CDN 根目录（{中文名}.png），本地按英文键存档，
# 与 site/js/app.js 中的 TYPE_ICONS 一一对应
CHARACTER_ICONS = {"铁甲战士": "IRONCLAD", "静默猎手": "SILENT", "储君": "REGENT",
                   "亡灵契约师": "NECROBINDER", "故障机器人": "DEFECT",
                   "无色牌": "COLORLESS", "先古之民": "ANCIENT", "其他": "OTHER"}
DETAIL_TYPES = {"cards": "cards", "relics": "relics", "enemies": "enemies"}  # 角色无详情页


def fetch_json(url: str, retries: int = 3):
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(1.5 * (i + 1))
    raise RuntimeError(f"fetch failed: {url} -> {last}")


def fetch_bytes(url: str, retries: int = 2):
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read()
        except Exception:  # noqa: BLE001
            time.sleep(1.0 * (i + 1))
    return None


def list_url(zh_type: str) -> str:
    q = urllib.parse.urlencode({"dataType": zh_type})
    return f"{API_BASE}/global/stat?{q}"


def detail_url(en_type: str, en_name: str) -> str:
    q = urllib.parse.urlencode({"dataType": en_type, "en_name": en_name})
    return f"{API_BASE}/detail?{q}"


def get_detail(en_type: str, item: dict):
    en_name = item.get("enName")
    if not en_name:
        return item, None
    try:
        resp = fetch_json(detail_url(en_type, en_name))
        if resp.get("code") == 200 and isinstance(resp.get("result"), dict):
            return item, resp["result"]
    except Exception as e:  # noqa: BLE001
        print(f"  [warn] detail failed {en_type}/{en_name}: {e}", file=sys.stderr)
    return item, None


def merge(item: dict, detail: dict | None) -> dict:
    """列表字段为底，详情字段覆盖/补充（详情的同名统计字段与列表一致）。"""
    if not detail:
        return item
    merged = dict(item)
    for k, v in detail.items():
        if v is not None:
            merged[k] = v
    return merged


def process_card_image(en_name: str) -> str | None:
    """卡图原图约 500KB，统一转 WebP(宽<=440) 存入站点目录，返回相对路径。"""
    try:
        from PIL import Image
    except ImportError:
        return None
    out = IMG_DIR / "card" / f"{en_name}.webp"
    if out.exists():
        return f"assets/img/card/{en_name}.webp"
    raw = fetch_bytes(f"{IMG_BASE}/card/{urllib.parse.quote(en_name)}.png")
    if not raw:
        return None
    try:
        im = Image.open(io.BytesIO(raw)).convert("RGBA")
        if im.width > 440:
            im = im.resize((440, round(im.height * 440 / im.width)), Image.LANCZOS)
        out.parent.mkdir(parents=True, exist_ok=True)
        im.save(out, "WEBP", quality=82, method=6)
        return f"assets/img/card/{en_name}.webp"
    except Exception as e:  # noqa: BLE001
        print(f"  [warn] card image failed {en_name}: {e}", file=sys.stderr)
        return None


def process_simple_image(sub: str, en_name: str) -> str | None:
    # 源站个别 enName 带空格（如遗物 HEFTY _TABLET）：请求时须 URL 编码，
    # 本地存档则去掉空格用干净文件名。
    local_name = en_name.replace(" ", "")
    out = IMG_DIR / sub / f"{local_name}.png"
    if out.exists():
        return f"assets/img/{sub}/{local_name}.png"
    raw = fetch_bytes(f"{IMG_BASE}/{sub}/{urllib.parse.quote(en_name)}.png")
    if not raw:
        return None
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(raw)
    return f"assets/img/{sub}/{local_name}.png"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-images", action="store_true")
    ap.add_argument("--no-details", action="store_true")
    ap.add_argument("--workers", type=int, default=10)
    args = ap.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    SITE_DIR.mkdir(parents=True, exist_ok=True)

    dataset: dict[str, list] = {}

    for zh_type, en_type in LIST_TYPES.items():
        print(f"[list] {zh_type} ...")
        items = fetch_json(list_url(zh_type))
        if not isinstance(items, list):
            raise RuntimeError(f"unexpected list payload for {zh_type}: {str(items)[:200]}")
        # 源站列表混有其内部测试条目（无描述、无图片），抓取时直接剔除
        dropped = [i.get("enName") for i in items if i.get("enName") in TEST_ENNAMES]
        if dropped:
            items = [i for i in items if i.get("enName") not in TEST_ENNAMES]
            print(f"  dropped test entries: {dropped}")
        print(f"  -> {len(items)} items")

        if en_type in DETAIL_TYPES and not args.no_details:
            print(f"[detail] {zh_type} x{len(items)} (workers={args.workers}) ...")
            merged = []
            done = 0
            with ThreadPoolExecutor(max_workers=args.workers) as ex:
                futs = {ex.submit(get_detail, en_type, it): it for it in items}
                for fut in as_completed(futs):
                    item, detail = fut.result()
                    merged.append(merge(item, detail))
                    done += 1
                    if done % 100 == 0:
                        print(f"  detail {done}/{len(items)}")
            # 保持与列表相同的稳定排序（按 enName）
            merged.sort(key=lambda x: x.get("enName") or "")
            items = merged

        dataset[en_type] = items
        out = DATA_DIR / f"{en_type}.json"
        out.write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"  saved {out.relative_to(ROOT)}")

    if not args.no_images:
        print("[images] cards -> webp ...")
        ok = 0
        cards = dataset["cards"]
        with ThreadPoolExecutor(max_workers=12) as ex:
            futs = {ex.submit(process_card_image, c["enName"]): c for c in cards if c.get("enName")}
            for fut in as_completed(futs):
                c = futs[fut]
                p = fut.result()
                c["imageLocal"] = p
                if p:
                    ok += 1
        print(f"  card images ok {ok}/{len(cards)}")

        print("[images] relics ...")
        ok = 0
        relics = dataset["relics"]
        with ThreadPoolExecutor(max_workers=12) as ex:
            futs = {ex.submit(process_simple_image, "relic", r["enName"]): r for r in relics if r.get("enName")}
            for fut in as_completed(futs):
                r = futs[fut]
                p = fut.result()
                r["imageLocal"] = p
                if p:
                    ok += 1
        print(f"  relic images ok {ok}/{len(relics)}")

        print("[images] character icons ...")
        ok = 0
        for zh, key in CHARACTER_ICONS.items():
            out = IMG_DIR / "character" / f"{key}.png"
            if out.exists():
                ok += 1
                continue
            raw = fetch_bytes(f"{IMG_BASE}/{urllib.parse.quote(zh)}.png")
            if raw:
                out.parent.mkdir(parents=True, exist_ok=True)
                out.write_bytes(raw)
                ok += 1
        print(f"  character icons ok {ok}/{len(CHARACTER_ICONS)}")

        print("[images] bosses ...")
        ok = tot = 0
        for e in dataset["enemies"]:
            if e.get("enemyType") == "Boss" and e.get("enName"):
                tot += 1
                p = process_simple_image("boss", e["enName"])
                e["imageLocal"] = p
                if p:
                    ok += 1
        print(f"  boss images ok {ok}/{tot}")

        # 图片路径写回 data/*.json
        for en_type, items in dataset.items():
            (DATA_DIR / f"{en_type}.json").write_text(
                json.dumps(items, ensure_ascii=False, indent=1), encoding="utf-8")

    # 生成网站数据文件
    payload = {
        "generatedAt": time.strftime("%Y-%m-%d %H:%M:%S"),
        "source": "https://www.gamersky.com/tools/sts2wiki/",
        **dataset,
    }
    (SITE_DIR / "data.js").write_text(
        "window.STS2_DATA = " + json.dumps(payload, ensure_ascii=False) + ";\n",
        encoding="utf-8")
    print(f"[done] site/data.js written; totals: " +
          ", ".join(f"{k}={len(v)}" for k, v in dataset.items()))


if __name__ == "__main__":
    main()
