"""承認済みの非生成マスク方式。原画像は変更せず、選択マスクだけ作る。"""
from pathlib import Path
import argparse
import hashlib
import json
from PIL import Image, ImageDraw
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT / "prototypes/sd-battle-motion/shared-body"
ASSETS = BASE / "assets"
QA = BASE / "generated/mask-qa"

# 首の接合部だけ。顎の線・耳・後ろ髪には触れない。
NECK_ERASE = {
    "arshe": [[333,489],[349,497],[366,505],[376,511],[381,511],[387,503],[390,488],[386,488],[383,501],[378,506],[366,501],[350,493],[334,485]],
    "karima": [[282,499],[295,508],[307,516],[324,525],[333,526],[341,515],[342,502],[337,502],[335,514],[331,520],[325,517],[310,511],[296,503],[285,495]],
}
BODY_ERASE = [[608,319],[620,316],[655,319],[680,326],[704,335],[704,346],[690,339],[675,335],[648,330],[620,330],[611,343],[606,350],[599,350],[605,330]]

# A1だけの手指定領域。同じ灰色でも布と金属は位置で分ける。
MATERIALS = {
    1: {"id":"cloth_tunic", "label":"上衣", "polygons":[
        [[589,353],[613,368],[641,381],[673,390],[704,389],[718,373],[734,390],[741,414],[610,416],[601,397]],
        [[490,435],[563,462],[592,430],[590,465],[579,496],[557,531],[546,537],[504,515],[474,504],[463,497],[474,477]],
        [[769,453],[811,451],[834,496],[821,514],[793,528],[768,537],[774,491]],
        [[601,551],[768,548],[779,572],[777,589],[585,590],[585,574]],
        [[586,621],[657,627],[650,693],[642,762],[533,739],[512,729],[549,671]],
        [[763,622],[789,625],[812,677],[837,731],[818,743],[774,755],[763,689]],
    ]},
    2: {"id":"cloth_trousers", "label":"ズボン", "polygons":[
        [[536,736],[626,754],[641,793],[665,803],[642,841],[613,884],[588,936],[578,965],[551,992],[515,993],[482,982],[458,970],[467,932],[494,896],[512,869],[512,849],[527,835]],
        [[672,800],[747,794],[775,752],[828,738],[835,774],[837,818],[832,855],[844,886],[835,915],[837,943],[846,978],[831,993],[792,1002],[753,997],[731,984],[726,957],[730,925],[732,907],[726,893],[733,877],[712,845]],
    ]},
    3: {"id":"cloth_waist", "label":"腰布", "polygons":[
        [[654,625],[764,625],[771,686],[781,760],[785,781],[776,791],[748,800],[693,800],[650,795],[632,788],[629,775],[640,691]],
    ]},
    4: {"id":"leather", "label":"革装備", "polygons":[
        [[573,365],[591,367],[608,382],[623,403],[632,416],[617,437],[608,471],[594,497],[578,509],[569,509],[570,495],[585,463],[592,434],[589,412],[582,395]],
        [[714,374],[728,381],[742,395],[757,428],[765,455],[752,441],[742,425],[728,416],[718,394]],
        [[588,586],[777,587],[786,616],[751,628],[676,631],[619,627],[585,619]],
        [[406,610],[431,609],[459,615],[479,626],[477,642],[461,665],[452,679],[425,671],[392,669],[389,660]],
        [[853,644],[877,627],[914,616],[934,614],[954,646],[957,669],[929,671],[887,688],[865,668]],
        [[456,961],[482,976],[523,991],[551,991],[579,979],[580,995],[563,1028],[549,1041],[536,1068],[541,1080],[533,1095],[537,1120],[547,1158],[541,1181],[511,1195],[461,1203],[417,1196],[392,1183],[385,1173],[388,1150],[411,1117],[430,1092],[434,1062],[444,1047],[446,1028],[438,1002],[448,973]],
        [[729,977],[750,994],[791,1002],[833,991],[850,975],[859,983],[862,1014],[854,1031],[863,1071],[885,1091],[918,1115],[958,1126],[978,1145],[985,1167],[970,1181],[931,1189],[896,1186],[862,1168],[826,1148],[809,1145],[803,1153],[771,1157],[738,1150],[734,1138],[741,1101],[749,1073],[736,1051],[737,1036],[728,1014]],
    ]},
    5: {"id":"armor", "label":"防具", "polygons":[
        [[610,415],[627,411],[727,414],[745,416],[762,440],[780,505],[780,540],[770,549],[774,559],[755,569],[730,577],[700,578],[669,572],[640,565],[621,557],[605,564],[587,564],[583,551],[589,528],[599,490],[607,447]],
        [[489,436],[496,415],[514,394],[535,378],[556,367],[574,367],[590,377],[601,393],[607,414],[598,430],[585,444],[571,459],[561,462],[544,453],[521,444],[501,438]],
        [[736,381],[752,382],[774,391],[788,404],[800,424],[814,451],[807,459],[789,464],[776,461],[761,444],[749,421]],
    ]},
}


def keep_mask(size, polygon):
    mask = Image.new("L", size, 255)
    ImageDraw.Draw(mask).polygon([tuple(point) for point in polygon], fill=0)
    return mask


def masked(source, mask):
    pixels = np.asarray(source).copy()
    pixels[np.asarray(mask) == 0, 3] = 0
    # 既存Studio消しゴムと同じalphaのみの選択削除。保持画素は不変。
    assert np.array_equal(pixels[:, :, :3], np.asarray(source)[:, :, :3])
    assert np.array_equal(pixels[np.asarray(mask) != 0], np.asarray(source)[np.asarray(mask) != 0])
    return Image.fromarray(pixels)


def prepare_seams():
    QA.mkdir(parents=True, exist_ok=True)
    provenance = json.loads((ASSETS / "outfit_provenance.json").read_text(encoding="utf-8"))
    for record in provenance["copies"]:
        assert digest(ASSETS / record["file"]) == record["sha256"], "入力が変わったので座標を再確認"
    records = []
    for key, polygon in NECK_ERASE.items():
        source = Image.open(ASSETS / f"{key}_extracted_head.png")
        mask = keep_mask(source.size, polygon)
        if key == "karima":
            # 接合線の離れた端だけを除く。右の後ろ髪はx>=345なので保持。
            ImageDraw.Draw(mask).rectangle((310,525,344,534), fill=0)
        name = f"{key}_neck_keep.png"
        mask.save(ASSETS / name)
        records.append({"file":name,"source":f"{key}_extracted_head.png","size":list(source.size),"sha256":digest(ASSETS/name),"erase_polygon":polygon,"erase_rectangles":[[310,525,344,534]] if key == "karima" else []})
        for index, head in enumerate([source, masked(source, mask)]):
            crop = head.crop((260 if key == "arshe" else 240,450 if key == "arshe" else 475,440 if key == "arshe" else 410,source.height))
            panel = Image.new("RGBA",crop.size,"#d6ddd9"); panel.alpha_composite(crop)
            panel.resize((crop.width*5,crop.height*5),Image.Resampling.NEAREST).convert("RGB").save(QA/f"{key}-neck-{'before' if index == 0 else 'after'}.png")
    for index in [1,2,3]:
        file = f"line_child_a{index}.png"
        source = Image.open(ASSETS / file)
        mask = keep_mask(source.size, BODY_ERASE)
        name = f"line_a{index}_neck_keep.png"; mask.save(ASSETS / name)
        records.append({"file":name,"source":file,"size":list(source.size),"sha256":digest(ASSETS/name),"erase_polygon":BODY_ERASE})
    (ASSETS / "seam_masks.json").write_text(json.dumps({"state":"試作・確認待ち","method":"alpha selection only; sources unchanged","masks":records},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("PASS: five localized seam masks; original hashes and retained RGBA unchanged")


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def prepare_palette():
    QA.mkdir(parents=True, exist_ok=True)
    file = "line_child_a1.png"
    source = Image.open(ASSETS / file).convert("RGBA")
    provenance = json.loads((ASSETS / "outfit_provenance.json").read_text(encoding="utf-8"))
    assert digest(ASSETS/file) == next(r["sha256"] for r in provenance["copies"] if r["file"] == file)
    p = np.asarray(source).astype(np.int16)
    r,g,b,a = [p[:,:,i] for i in range(4)]
    labels = np.zeros(p.shape[:2], dtype=np.uint8)
    # RGBガードは手指定領域の安全柵。肌・濃い線・半透明縁は保護する。
    safe = (a >= 250) & (np.max(p[:,:,:3],axis=2) > 55)
    skin = (r > 170) & (r-g > 17) & (g-b > 15)
    neutral = (np.max(p[:,:,:3],axis=2)-np.min(p[:,:,:3],axis=2) < 35)
    guards = {1:neutral,2:neutral,3:(r-g>22)&(r-b>18),4:(r-g>3)&(r-b>3),5:neutral}
    for code, material in MATERIALS.items():
        region = Image.new("L", source.size, 0)
        draw = ImageDraw.Draw(region)
        for polygon in material["polygons"]:
            draw.polygon([tuple(point) for point in polygon], fill=255)
        labels[(np.asarray(region)>0)&safe&~skin&guards[code]] = code
    # バックルの金属枠と内側の境界線は初期試作では全体を固定。
    labels[583:638,684:745] = 0
    mask_file = "line_a1_materials.png"
    Image.fromarray(labels).save(ASSETS/mask_file)
    counts = {v["id"]:int(np.sum(labels==k)) for k,v in MATERIALS.items()}
    assert all(value > 1000 for value in counts.values())
    assert not np.any((labels>0)&((a<250)|skin|(np.max(p[:,:,:3],axis=2)<=55)))
    manifest = {"state":"試作・境界確認用", "source":file,"source_sha256":digest(ASSETS/file),"file":mask_file,"size":list(source.size),"sha256":digest(ASSETS/mask_file),"groups":[dict(code=k,**v,pixels=counts[v["id"]]) for k,v in MATERIALS.items()],"protected":"肌・alpha<250の縁・濃い線・バックル全体。alphaは全画素で保持。薄い素材境界は目視確認対象。"}
    (ASSETS/"palette_masks.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    overlay = np.asarray(source).copy()
    colors = [[60,146,120],[78,132,163],[173,82,67],[155,111,48],[139,101,162]]
    for code,color in enumerate(colors,1):
        overlay[labels==code,:3] = color
    panel = Image.new("RGBA",source.size,"#d6ddd9");panel.alpha_composite(Image.fromarray(overlay))
    panel.convert("RGB").save(QA/"a1-material-overlay.png")
    print("PASS: A1-only geometry mask, protected skin/alpha/ink/buckle; pixels",counts)


def inspect():
    QA.mkdir(parents=True, exist_ok=True)
    specs = [
        ("arshe_extracted_head.png", (285, 455, 430, 511), 6, "arshe-neck-grid.png"),
        ("karima_extracted_head.png", (240, 478, 410, 535), 6, "karima-neck-grid.png"),
        ("line_child_a1.png", (570, 300, 750, 410), 5, "body-neck-grid.png"),
        ("line_child_a1.png", (390, 350, 910, 800), 2, "a1-upper-grid.png"),
        ("line_child_a1.png", (385, 770, 990, 1210), 2, "a1-lower-grid.png"),
    ]
    for file, bounds, factor, target in specs:
        source = Image.open(ASSETS / file)
        crop = source.crop(bounds)
        panel = Image.new("RGBA", crop.size, "#d6ddd9")
        panel.alpha_composite(crop)
        panel = panel.resize((crop.width * factor, crop.height * factor), Image.Resampling.NEAREST).convert("RGB")
        draw = ImageDraw.Draw(panel)
        step = 10 if factor > 2 else 40
        for x in range(bounds[0], bounds[2], step):
            px = (x - bounds[0]) * factor
            draw.line((px, 0, px, panel.height), fill="#87a8a0")
            draw.text((px + 2, 0), str(x), fill="#1c302c")
        for y in range(bounds[1], bounds[3], step):
            py = (y - bounds[1]) * factor
            draw.line((0, py, panel.width, py), fill="#87a8a0")
            draw.text((0, py + 2), str(y), fill="#1c302c")
        panel.save(QA / target)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inspect", action="store_true")
    parser.add_argument("--palette", action="store_true")
    args = parser.parse_args()
    if args.inspect:
        inspect()
    elif args.palette:
        prepare_palette()
    else:
        prepare_seams()
