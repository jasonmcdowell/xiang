export type SiteLanguage = "en" | "zh-Hant" | "zh-Hans";

const copy: Record<Exclude<SiteLanguage, "en">, Record<string, string>> = {
  "zh-Hant": {
    Language: "語言",
    "Tile writing": "字牌字體",
    "Simplified tiles": "簡體字牌",
    "Traditional tiles": "繁體字牌",
    "Xiang 想 — A little character play": "Xiang 想 — 漢字小玩意",
    "Character physics lab — Xiang playground": "漢字物理實驗室 — Xiang 遊樂場",
    "Dictionary lab — Xiang": "字典實驗室 — Xiang",
    "Main navigation": "主選單",
    "Xiang home": "Xiang 首頁",
    Split: "拆解",
    Select: "選取",
    "can combine with another tile": "可與其他字牌組合",
    Unfold: "拆解",
    "Drag onto another tile to combine": "拖曳到另一張字牌上即可組合",
    "Select {char} to combine without unfolding":
      "選取 {char} 以完整字牌進行組合",
    "seconds abbreviation": "秒",
    "First discoveries": "初次發現",
    "Nature & light": "自然與光",
    "People & words": "人物與文字",
    "Three of a kind": "三個一組",
    "Everyday pieces": "日常部件",
    "{score} points · {count} unique discoveries this run.":
      "{score} 分 · 本回合發現 {count} 個不同漢字。",
    "+3 seconds per composition · +1 point, plus +1 for a new discovery":
      "每次組合 +3 秒、+1 分；新發現再 +1 分",
    "Add character": "加入漢字",
    "Select {char}": "選取 {char}",
    "Click a character on the board. Its parts move to your tray. Try 想 → 相 + 心, then click 相 in the tray to get 木 + 目.":
      "點擊遊戲區中的漢字，部件就會移到字盤。試試 想 → 相 + 心，再點擊字盤中的相，取得 木 + 目。",
    "A character you make stays on the board. Split it again, learn its meaning, or try a different pairing.":
      "組成的漢字會留在遊戲區。你可以再次拆解、認識字義，或嘗試不同組合。",
    "can appear as": "可以寫成",
    Privacy: "隱私",
    Playground: "物理遊樂場",
    "Dictionary lab": "字典實驗室",
    "How to play": "玩法說明",
    "A LITTLE CHARACTER PLAY": "漢字小玩意",
    "The characters couldn’t load.": "漢字資料載入失敗。",
    "A little room for discovery.": "留一點空間，探索漢字。",
    "Check your connection and try again.": "請檢查網路連線後再試一次。",
    "Setting out your tiles…": "正在擺好字牌……",
    "Try again": "再試一次",
    "TAKE APART. PUT TOGETHER. SEE SOMETHING NEW.": "拆解、組合，發現新意。",
    "A world inside every character": "每個漢字裡，都藏著一個世界",
    "A tree. An eye. A heart. A thought. Discover how Chinese characters connect.":
      "一棵樹、一隻眼、一顆心，組成一個念頭。來探索漢字之間的連結。",
    "Tree plus eye plus heart becomes thought": "木加目加心，組成想",
    "Game mode": "遊戲模式",
    Explore: "自由探索",
    "Timed challenge": "限時挑戰",
    "A little pressure. A lot of possibility.": "一點時間壓力，無限組字可能。",
    "No clock. Just curiosity.": "沒有倒數，只有好奇。",
    Pinyin: "拼音",
    "Run controls": "回合控制",
    "READY WHEN YOU ARE": "準備好就開始",
    "TAKE A BREATH": "稍作休息",
    "A LITTLE MORE DISCOVERED": "又多發現了一些",
    "60 seconds. How much will you discover?": "60 秒內，你能發現多少？",
    "Your table is waiting.": "牌桌正等著你。",
    "A full tray. A fresh start?": "字盤已滿，要重新開始嗎？",
    "Time’s up. Nicely explored.": "時間到，探索得真不錯。",
    "8 starting tiles. A new one every 6 seconds. Make space before the 13th arrives.":
      "從 8 張字牌開始，每 6 秒加入一張。第 13 張到來前記得騰出空間。",
    "The clock and incoming tiles are paused.": "倒數和新字牌都已暫停。",
    "Start challenge →": "開始挑戰 →",
    "Keep playing →": "繼續遊玩 →",
    "New run →": "重新開始 →",
    "Challenge status": "挑戰狀態",
    "TIME LEFT": "剩餘時間",
    SCORE: "分數",
    "SESSION BEST": "本次最高分",
    Resume: "繼續",
    Pause: "暫停",
    "Character board": "漢字區",
    "Your character board": "你的漢字區",
    "{count} characters": "{count} 個漢字",
    "Click a character to unfold it into its parts.":
      "點擊漢字，將它拆解成組成部分。",
    "Your next discovery belongs here.": "下一個新發現會出現在這裡。",
    "Combine two or three tiles from the tray below.":
      "從下方字盤選兩到三張字牌來組合。",
    "Made characters stay here. Split them to reuse their parts.":
      "組成的漢字會留在這裡。拆解它們，就能重用各個部分。",
    "Unfold one tile at a time. Use + to select a tray tile intact.":
      "每次拆解一張字牌。使用 + 可直接選取字盤中的完整字牌。",
    Undo: "復原",
    "Component tray": "部件字盤",
    "Your component tray": "你的部件字盤",
    "{count} tiles": "{count} 張字牌",
    "Drag a tile onto another to combine. On touch screens, use the dotted grip. Click to unfold; use + to select.":
      "將一張字牌拖到另一張上即可組合。觸控螢幕請拖曳點狀把手。點擊可拆解；使用 + 可選取完整字牌。",
    "Next tile in {seconds}s": "下一張字牌將於 {seconds} 秒後加入",
    "Selected components": "已選部件",
    "A new possibility?": "會組成什麼呢？",
    "Pick two pieces": "選擇兩個部件",
    "Hide combination hints": "隱藏組字提示",
    "Highlight all tiles with a valid combination partner":
      "標示所有可與其他字牌組合的字牌",
    Hint: "提示",
    Combine: "組合",
    "Tile set": "字牌組合",
    "Reset table": "重置字桌",
    "Add a character": "加入漢字",
    "Try a character: 好": "試試輸入漢字：好",
    "Character field guide": "漢字小指南",
    "THE FIELD GUIDE": "漢字小指南",
    "Pronunciation unavailable": "暫無讀音資料",
    "A character to explore": "等你探索的漢字",
    "Every piece is a place to begin.": "每個部件都是探索的起點。",
    "LOOK INSIDE": "看看組成",
    "A SINGLE PIECE": "單一漢字",
    "Learn about {char}": "查看「{char}」的資料",
    "No supported split in our dictionary. This tile may still be a part of another character.":
      "字典中沒有支援的拆解方式，但這個字仍可能是其他漢字的部件。",
    "GOOD TO KNOW": "小知識",
    "Parts sometimes change shape inside a character. ":
      "部件在漢字中有時會變形。例如",
    " — we keep the full character on your tile.":
      "會寫成忄；字牌上仍會顯示完整的心字。",
    "YOUR SMALL COLLECTION": "你的漢字收藏",
    "Made by you": "由你組成",
    "Every character you create becomes a little discovery.":
      "你組成的每個漢字，都是一個新發現。",
    "Your first one is just two tiles away.":
      "再組合兩張字牌，就能有第一個新發現。",
    "MORE THAN ONE POSSIBILITY": "不只一種可能",
    "Cancel composition": "取消組合",
    "Which character will you make?": "你想組成哪個漢字？",
    " can become ": " 可以組成 ",
    " different characters. Choose one.": " 個不同的漢字。請選一個。",
    "Definition unavailable": "暫無字義資料",
    "Keep my tiles": "保留目前字牌",
    "WELCOME TO XIANG": "歡迎來到 Xiang",
    "Close instructions": "關閉說明",
    "Characters are made of possibilities.": "漢字裡藏著各種可能。",
    "Take one apart.": "拆解漢字。",
    "Make something new.": "組成新字。",
    "Follow your curiosity.": "跟著好奇心探索。",
    "Let’s explore →": "開始探索 →",
    "Start with 想. Click it to discover what’s inside.":
      "從想開始。點擊它，看看裡面有哪些部件。",
    "Start with {char}. Click it to discover what’s inside.":
      "從 {char} 開始。點擊它，看看裡面有哪些部件。",
    "Build characters. Make room. Keep the clock alive.":
      "組字、騰出空間，讓倒數繼續。",
    "Select two components, then combine them.": "選擇兩個部件，再將它們組合。",
    "Combine up to three tiles. Deselect a tile first.":
      "最多可組合三張字牌。請先取消一張字牌的選取。",
    "Last move undone.": "已復原上一步。",
    "Combination hints hidden.": "已隱藏組字提示。",
    "{count} tiles have at least one valid combination. Hints don’t show which pieces match.":
      "有 {count} 張字牌至少能組成一個有效漢字。提示不會指出哪些字牌彼此配對。",
    "No combination yet. Unfold a tile or wait for a new component.":
      "目前無法組合。試著拆解一張字牌，或等候新的部件。",
    "Select up to three tiles. Deselect one to change the combination.":
      "最多選三張字牌。取消選取一張即可更改組合。",
    "Your pieces, a new possibility. Try Combine.":
      "部件已備妥，試著按「組合」看看。",
    "Choose one more component from the tray.": "再從字盤選一個部件。",
    "{char} has no usable one-level split in this dictionary.":
      "字典中沒有可用的「{char}」一階拆解方式。",
    "Combine some tray tiles first (48-tile limit).":
      "請先組合一些字牌（上限為 48 張）。",
    "{char} → {children}. The pieces are in your tray.":
      "{char} → {children}。部件已放入字盤。",
    "Enter one Chinese character from the dictionary.":
      "請輸入一個字典中有收錄的漢字。",
    "Split a board character first (24-character limit).":
      "請先拆解一個漢字（上限為 24 個）。",
    "Added {char}. Click it to explore its components.":
      "已加入 {char}。點擊它即可探索組成部件。",
    "Added {char}. This character has no usable one-level split.":
      "已加入 {char}。這個漢字沒有可用的一階拆解方式。",
    "No match for {pair} in this dictionary. Try another pair.":
      "字典中找不到 {pair} 的組合。請試試其他部件。",
    "{pair} → {char} · New discovery!": "{pair} → {char} · 新發現！",
    "{pair} → {char} · Nicely done.": "{pair} → {char} · 做得好。",
    " +{points} points · +3 seconds": " +{points} 分 · +3 秒",
    "Character data by ": "漢字資料來源：",
    "Combine two or three tray tiles (use + to keep a tile intact), then Combine. If there’s more than one result, you choose. You can also drag one tile onto another; drag a selected pair onto a third tile for three-piece recipes. On touch screens, drag the dotted grip. Press Escape to cancel. Invalid combinations keep your tiles.":
      "選取兩到三張字盤字牌（使用 + 可保留完整字牌），再按「組合」。若有多種結果，可自行選擇。也可以將字牌拖到另一張上；若要組成三部件漢字，請將已選取的一對拖到第三張上。觸控螢幕請拖曳點狀把手。按 Escape 取消。無效組合不會消耗字牌。",
    "Explore freely, or try the timed challenge: 60 seconds, a new tile every 6 seconds, and a 12-tile tray. Each composition adds 3 seconds and 1 point, plus 1 point for a new character. A 13th tile ends the run—even when splitting a board character.":
      "自由探索，或試試限時挑戰：時間為 60 秒，每 6 秒加入一張新字牌，字盤最多容納 12 張。每次組合可增加 3 秒和 1 分；首次組成新漢字再加 1 分。若第 13 張字牌加入，挑戰便會結束，即使它是拆解漢字所得也一樣。",
    "These are structural dictionary relationships, not always the historical origins of a character. Tile order doesn’t matter. Only complete, supported recipes are used, including reviewed three-piece splits such as 森 → 木 + 木 + 木.":
      "這些是字典中的結構關係，不一定代表漢字的歷史字源。組合時部件順序不限。遊戲只使用完整且受支援的拆解方式，包括已審核的三部件拆解，例如 森 → 木 + 木 + 木。",
    "A little play. A different way to see.": "一點玩心，換個角度看漢字。",
    "Physical playground": "物理遊樂場",
    "Back to the game ↗": "回到遊戲 ↗",
    "Pull it apart. Bring it back together.": "拆開它，再把它組回來。",
    "Character gameboard": "漢字遊戲區",
    "Physical {board} playground in {style} surface style. Drag a mapped ink component while its source tile and remaining strokes stay in place. As soon as the component clears its source tile, it becomes a new tile that follows the held strokes until release, even if other tiles are nearby. Drag ink on a character without a supported decomposition to move the tile and ink together. Drag a blank tile face to move the whole character. Overlap compatible tile faces, or hold a detachable piece's ink over the compatible tile, to recombine.":
      "{board}的物理遊樂場，使用{style}表面。拖曳有對應拆解方式的筆畫部件時，原字牌和其餘筆畫會留在原位；部件一離開原字牌，就會成為新字牌並跟隨手指直到放開，即使附近還有其他字牌也一樣。若漢字沒有受支援的拆解方式，拖曳筆畫會連同字牌一起移動。拖曳空白牌面也可移動整個漢字。讓相容字牌重疊，或將可拆離部件的筆畫拖到相容字牌上，即可重新組合。",
    "The character outlines couldn’t load.": "漢字筆畫外框載入失敗。",
    "The characters are taking shape…": "漢字正在成形……",
    "A little give. A little gravity.": "一點彈性，一點重力。",
    "Playground controls": "遊樂場控制項",
    "HOW TO PLAY": "玩法說明",
    "Pull, place, recombine": "拉開、擺放、重新組合",
    "Start with five characters. Pull a mapped stroke group away. The rest stays in place; as soon as the component clears its source tile, both pieces become tiles and the pulled tile follows your finger until release. Other tiles do not need to be moved out of the way. On characters without a supported decomposition, dragging the strokes moves the tile and ink together. Overlap compatible tiles to recombine them, or hold a detachable piece's ink over the compatible tile to guide it into place.":
      "從五個漢字開始。拉開有對應拆解方式的筆畫組，其餘部分會留在原位；部件一離開原字牌，兩部分就會成為字牌，且被拉動的字牌會跟隨手指直到放開。即使附近還有其他字牌，也不必先移開。沒有受支援拆解方式的漢字，拖曳筆畫時會連同字牌一起移動。讓相容字牌重疊即可重新組合；也可將可拆離部件的筆畫停在相容字牌上方，引導它就位。",
    "Double-tap a character or one of its strokes to unfold one supported step.":
      "連點兩下漢字或其中一組筆畫，即可拆解一個受支援的步驟。",
    "Drag a blank tile face to move the whole character. Fixed keeps it centered; Weighted gives it more movement.":
      "拖曳空白牌面可移動整個漢字。「固定」會讓漢字留在中央；「有重量」則會讓它帶有阻力地移動。",
    "Add any drawable dictionary character to keep building the board, or explore it alone to replace the current scene.":
      "可加入任何有筆畫資料的字典漢字，繼續擴展遊戲區；也可以單獨探索一個漢字，取代目前場景。",
    "IN FOCUS": "目前焦點",
    "Loading definition…": "正在載入字義……",
    "Starting board": "起始遊戲區",
    "Five starters": "五個起始漢字",
    "Try a character": "試試一個漢字",
    "Any dictionary character": "任一字典漢字",
    "Loading…": "載入中……",
    "Add to board": "加入遊戲區",
    "Thousands of": "數千種",
    "glyph outlines load only when needed.": "種字形外框會在需要時才載入。",
    "HSK 1 character set": "HSK 1 漢字清單",
    "HSK 1 characters": "HSK 1 漢字",
    "Writing system": "書寫系統",
    Simplified: "簡體中文",
    Traditional: "繁體中文",
    "Loading HSK 1…": "正在載入 HSK 1……",
    "The HSK 1 character list could not be loaded.":
      "無法載入 HSK 1 漢字清單。",
    Retry: "重試",
    "drawable characters": "個可繪製漢字",
    "without stroke outlines": "個沒有筆畫外框",
    "Add {char} from HSK 1": "從 HSK 1 加入 {char}",
    "Click a character to add it to the current board. HSK 2.0 list.":
      "點擊漢字即可加入目前遊戲區。採用 HSK 2.0 清單。",
    Source: "來源",
    "MIT license": "MIT 授權",
    "Character weight": "漢字重量",
    Fixed: "固定",
    "stays centered": "維持在中央",
    Weighted: "有重量",
    "moves with resistance": "帶有阻力地移動",
    "Tile interaction": "字牌互動",
    "Tile repulsion": "字牌互斥",
    "loose faces nudge apart": "鬆動的牌面會輕輕推開彼此",
    "Pop sound when a component tears free": "部件撕離時播放啵的一聲",
    "Tile tools": "字牌工具",
    "Arrange mode": "排列方式",
    "Arrange tiles": "排列字牌",
    "Blast!": "炸散字牌！",
    Shuffle: "洗牌",
    "Keep arranged": "保持排列",
    "Re-run this arrange mode whenever new tiles are added.":
      "新增字牌時，重新套用此排列方式。",
    "One at a time": "逐一移動",
    "All at once": "同時移動",
    "Group by shared components": "依共用部件分組",
    "Snap to grid when released": "放開時吸附至格線",
    "Highlight compatible tiles": "標示可組合字牌",
    "Hide tile hints": "隱藏字牌提示",
    "{count} compatible tiles highlighted": "已標示 {count} 張可組合字牌",
    "No compatible loose tiles for this character.":
      "目前沒有可與此字組合的獨立字牌。",
    "Surface style": "表面樣式",
    Flat: "平面",
    "ink only": "只有筆畫",
    Raised: "浮雕",
    embossed: "凸起效果",
    Draped: "垂掛",
    "over the edge": "垂過邊緣",
    Silk: "絲",
    "down to the table": "垂落桌面",
    "Game board": "遊戲棋盤",
    "Bamboo table": "竹桌",
    "Single slate slab": "整塊石板",
    "Traditional Go board · 19×19": "傳統木製圍棋盤 · 19×19",
    "Compact Go board · 9×9": "小型圍棋盤 · 9×9",
    "Rice-paper scroll": "宣紙卷軸",
    "Physics controls": "物理效果控制",
    Softness: "柔軟度",
    Still: "靜止",
    Firm: "堅實",
    Floppy: "柔軟",
    Supple: "有彈性",
    "Give it a nudge": "輕推一下",
    Reset: "重置",
    "Reduce motion": "減少動態效果",
    "Keyboard: arrows to nudge · R to reset · F for fullscreen · Escape to release.":
      "鍵盤：方向鍵輕推 · R 重置 · F 全螢幕 · Escape 放開。",
    "Reviewed outlines and component matches: ": "已審核的筆畫外框和部件配對：",
    "Arphic Public License": "Arphic 公眾授權",
    "Enter one Chinese character.": "請輸入一個漢字。",
    "No usable drawing data was found for {char}. Try another dictionary character.":
      "找不到「{char}」可用的筆畫資料。請試試其他字典漢字。",
    "Five starters are ready. Pull a component away from any character to explore it.":
      "五個起始漢字已就緒。從任一漢字拉出部件來探索。",
    "Pull a component outward. Stretch its seam to tear it free.":
      "向外拉動部件。將接縫拉開即可撕離。",
    "Pull {part} away. The rest stays in place.":
      "拉開 {part}。其餘部分會留在原位。",
    "Move a tile to make room for both components.":
      "移動字牌，為兩個部件騰出空間。",
    "Finish the current drag before adding a character.":
      "請先完成目前的拖曳，再加入漢字。",
    "Finish the current drag before unfolding a tile.":
      "請先完成目前的拖曳，再拆解字牌。",
    "This character has no reviewed physical decomposition yet.":
      "這個漢字尚無經審核的物理拆解資料。",
    "Some character outlines could not be loaded. Try selecting that character again.":
      "部分漢字外框無法載入。請再選一次該漢字。",
    "Component strokes are ready for {chars}. Pull one to continue.":
      "{chars} 的部件筆畫已就緒。拉動其中一個即可繼續。",
    "Loading component strokes for {chars}…": "正在載入 {chars} 的部件筆畫……",
    "{char} has an outline, but no complete physical component mapping yet.":
      "「{char}」有筆畫外框，但尚無完整的物理部件對應資料。",
    "{char} added as a new tile. Pull a component or combine it with another character.":
      "已將「{char}」加入成新字牌。拉出部件，或與其他漢字組合。",
    "There isn’t room for another tile. Move a tile and try again.":
      "空間不足，無法再加入字牌。請移動一張字牌後再試。",
    "Keep pulling until the component clears its source tile.":
      "繼續拉動，直到部件離開原字牌。",
    "Guide the pulled component back inside the board before it separates.":
      "在部件分離前，請將它移回遊戲區內。",
    "Guide both pieces back inside the board before they separate.":
      "請先將兩個部件移回遊戲區，再讓它們分離。",
    "Start with five characters. Pull a mapped stroke group away until it becomes its own tile.":
      "從五個漢字開始。拉開已標記的筆畫組，直到它成為獨立字牌。",
    "The dictionary couldn’t load. Please reload to try again.":
      "字典載入失敗，請重新載入再試一次。",
    "Loading character data…": "正在載入漢字資料……",
    "complete decompositions": "個完整拆解",
    "ordered pair entries": "組有序配對",
    "A CLOSER LOOK AT THE PIECES": "深入看看漢字部件",
    "The dictionary lab.": "字典實驗室。",
    "Explore the same supported relationships that make the game work.":
      "探索遊戲中使用的漢字結構關係。",
    "01 / TAKE APART": "01 / 拆解",
    "Inside a character": "漢字的組成",
    Character: "漢字",
    "Normalized: ": "正規化後：",
    "No supported decomposition found.": "找不到受支援的拆解方式。",
    "02 / PUT TOGETHER": "02 / 組合",
    "Find a new character": "找出可組成的漢字",
    "Component A": "部件 A",
    "Component B": "部件 B",
    "Component C (optional)": "部件 C（選填）",
    "For three-piece recipes": "用於三部件組合",
    "No matching composition found.": "找不到相符的組合。",
    "Order doesn’t matter. Select a result to look inside it.":
      "部件順序不限。選擇結果即可查看其組成。",
    "{count} starter characters": "{count} 個起始漢字",
    "{count} custom characters": "{count} 個自選漢字",
    "THE PLAYGROUND / PHYSICS LAB": "物理遊樂場／實驗室",
    "Character details for {char}": "「{char}」的漢字資料",
    "Loading pronunciation…": "正在載入讀音……",
    Add: "加入",
    "{count} glyph outlines load only when needed.":
      "{count} 個字形外框會在需要時才載入。",
    "Frequency: ": "出現頻率：",
    "Xiang runs in your browser. Its application code does not create accounts, send game actions to a server, set or read cookies, store gameplay activity, or load analytics or advertising scripts. Your game state stays in memory for the current page visit and resets when you reload. Your chosen language preference is stored locally in your browser and is not sent to Xiang servers.":
      "Xiang 在你的瀏覽器中執行。應用程式不會建立帳號、不會將遊戲操作傳送至伺服器、不會設定或讀取 Cookie、不會儲存遊戲活動，也不會載入分析或廣告程式。遊戲狀態只保留在目前頁面的記憶體中，重新載入後便會重置。你選擇的語言會儲存在瀏覽器本機，不會傳送至 Xiang 伺服器。",
    "The site is hosted by GitHub Pages. GitHub says it logs and stores visitors’ IP addresses for security purposes. GitHub handles that information under its own privacy practices. Read the ":
      "本網站由 GitHub Pages 託管。GitHub 表示，為了安全目的會記錄並保存訪客的 IP 位址，並依照自身的隱私政策處理這些資訊。請參閱",
    whole: "完整",
    stretching: "拉伸中",
    loose: "已分離",
    "Time’s up. Every discovery counts.": "時間到，每個新發現都值得慶祝。",
    "The tray filled up. Give it another try.": "字盤已滿，再試一次吧。",
    "{char} added as a new tile. It has an outline but no complete physical component mapping.":
      "已將「{char}」加入成新字牌。它有筆畫外框，但尚無完整的物理部件對應資料。",
    "{count} drawable characters": "{count} 個可繪製漢字",
    " · {count} without stroke outlines": " · {count} 個沒有筆畫外框",
    "Thousands of glyph outlines load only when needed.":
      "數千種字形外框會在需要時才載入。",
    "Only complete recipes are kept. Reviewed nested recipes such as 森 → 木 + 木 + 木 are supported; other nested expressions remain excluded. common forms such as 忄 and 氵 normalize to 心 and 水. These structural recipes are not claims about etymology.":
      "只保留完整的拆解規則。已審核的巢狀規則（例如 森 → 木 + 木 + 木）也受支援；其他巢狀結構仍不包含在內。常見部件形式如忄、氵會正規化為心、水。這些結構規則不代表字源考證。",
    "Privacy — Xiang": "隱私 — Xiang",
    "A SMALL, SELF-CONTAINED PROJECT": "一個小型的獨立專案",
    "Xiang runs in your browser. Its application code does not create accounts, send game actions to a server, set or read cookies, use browser storage, or load analytics or advertising scripts. Your game state stays in memory for the current page visit and resets when you reload.":
      "Xiang 在你的瀏覽器中執行。應用程式不會建立帳號、不會將遊戲操作傳送至伺服器、不會設定或讀取 Cookie，也不會載入分析或廣告程式。遊戲狀態只保留在目前頁面的記憶體中，重新載入後便會重置。所選語言會保存在瀏覽器的本機儲存空間。",
    "GitHub says it logs and stores visitors’ IP addresses for security purposes. GitHub handles that information under its own privacy practices.":
      "GitHub 表示，為了安全目的會記錄並保存訪客的 IP 位址。GitHub 會依照自身的隱私政策處理這些資訊。",
    "Read the ": "閱讀",
    "GitHub Privacy Statement": "GitHub 隱私聲明",
    "Xiang is a personal project by Jason McDowell. For questions, use the ":
      "Xiang 是 Jason McDowell 的個人專案。如有問題，請前往",
    "Xiang project repository": "Xiang 專案儲存庫",
    "← Back to Xiang": "← 返回 Xiang",
    "← Back to play": "← 返回遊戲",
    "Playground games": "遊樂場遊戲",
    "Discovery Run": "發現之旅",
    "Discovery Run controls": "發現之旅控制項",
    "SURVIVAL GAME": "生存遊戲",
    "Make room for discovery": "騰出空間，探索新字",
    "A new character arrives every 10 seconds. Keep the board below its tile limit by tearing characters apart and recombining their pieces. The run ends when the board fills.":
      "每 10 秒會出現一個新漢字。拆解漢字並重新組合部件，讓字牌數保持在上限以下。遊戲區填滿時，本回合結束。",
    "Earn one point for each character delivered and one for every distinct character outside your collection that appears, even if you later recombine it.":
      "每加入一個漢字可得一分；每發現一個不在所選字集中的不同漢字也可得一分，即使之後重新組合仍會保留紀錄。",
    "Tile collection": "字牌字集",
    "Playground collection": "遊樂場字集",
    "HSK 1 Simplified": "HSK 1 簡體字",
    "HSK 1 Traditional": "HSK 1 繁體字",
    "Board size": "遊戲區大小",
    "{count} spaces · {grid}×{grid}": "{count} 格 · {grid}×{grid}",
    "Tiles are sized to fit the cells and snap into place when released.":
      "字牌會縮放以符合格子，放開時會吸附到格位。",
    "Start Discovery Run": "開始發現之旅",
    "Preparing the board…": "正在準備遊戲區……",
    "Choose a collection and board size, then start.":
      "選擇字集和遊戲區大小，然後開始。",
    "Discovery Run game board": "發現之旅遊戲區",
    TILES: "字牌",
    DISCOVERED: "新發現",
    SURVIVED: "存活時間",
    "Next character in {seconds}s": "下一個漢字將於 {seconds} 秒後到來",
    "New tile in {seconds}s": "新字牌將於 {seconds} 秒後到來",
    "{count} new characters": "{count} 個新漢字",
    "RUN COMPLETE": "本回合結束",
    "The board is full.": "遊戲區已滿。",
    Score: "分數",
    "Run again": "再玩一回合",
    "CURRENT SCORE": "目前分數",
    delivered: "已加入",
    discoveries: "個新發現",
    "Board capacity": "字牌上限",
    "DISCOVERED CHARACTERS": "已發現的漢字",
    "New characters discovered": "新發現的漢字",
    "Pull apart a character to make your first discovery.":
      "拆解漢字，尋找第一個新發現。",
    "Pause and return to Playground": "暫停並返回物理遊樂場",
    "Start with a character from a selected collection":
      "從所選字集中的漢字開始",
    "Switching to Playground pauses the arrival clock. Your run and score stay here when you return.":
      "切換到物理遊樂場時，新字牌的倒數會暫停。返回後可繼續目前回合和分數。",
    "Character strokes load as they are needed.": "漢字筆畫會在需要時載入。",
    "A tile could not be loaded from this collection. The run is still going.":
      "無法載入此字集中的字牌。本回合會繼續。",
    "The run is on. A new character arrives every 10 seconds.":
      "本回合開始。每 10 秒會出現一個新漢字。",
  },
  "zh-Hans": {
    "Tile writing": "字牌字体",
    "Simplified tiles": "简体字牌",
    "Traditional tiles": "繁体字牌",
    "Main navigation": "主选单",
    "Xiang home": "Xiang 首页",
    Split: "拆解",
    Select: "选择",
    "can combine with another tile": "可与其他字牌组合",
    Unfold: "拆解",
    "Drag onto another tile to combine": "拖动到另一张字牌上即可组合",
    "Select {char} to combine without unfolding":
      "选择 {char} 以完整字牌进行组合",
    "seconds abbreviation": "秒",
    "First discoveries": "初次发现",
    "Nature & light": "自然与光",
    "People & words": "人物与文字",
    "Three of a kind": "三个一组",
    "Everyday pieces": "日常部件",
    "{score} points · {count} unique discoveries this run.":
      "{score} 分 · 本回合发现 {count} 个不同汉字。",
    "+3 seconds per composition · +1 point, plus +1 for a new discovery":
      "每次组合 +3 秒、+1 分；新发现再 +1 分",
    "Add character": "添加汉字",
    "Select {char}": "选择 {char}",
    "Click a character on the board. Its parts move to your tray. Try 想 → 相 + 心, then click 相 in the tray to get 木 + 目.":
      "点击游戏区中的汉字，部件就会移到字盘。试试 想 → 相 + 心，再点击字盘中的相，取得 木 + 目。",
    "A character you make stays on the board. Split it again, learn its meaning, or try a different pairing.":
      "组成的汉字会留在游戏区。你可以再次拆解、了解字义，或尝试不同组合。",
    "can appear as": "可以写成",
    Language: "语言",
    "Xiang 想 — A little character play": "Xiang 想 — 汉字小游戏",
    "Character physics lab — Xiang playground": "汉字物理实验室 — Xiang 游乐场",
    "Dictionary lab — Xiang": "字典实验室 — Xiang",
    Privacy: "隐私",
    Playground: "物理游乐场",
    "Dictionary lab": "字典实验室",
    "How to play": "玩法说明",
    "A LITTLE CHARACTER PLAY": "汉字小游戏",
    "The characters couldn’t load.": "汉字数据加载失败。",
    "A little room for discovery.": "留一点空间，探索汉字。",
    "Check your connection and try again.": "请检查网络连接后再试一次。",
    "Setting out your tiles…": "正在摆好字牌……",
    "Try again": "再试一次",
    "TAKE APART. PUT TOGETHER. SEE SOMETHING NEW.": "拆解、组合，发现新意。",
    "A world inside every character": "每个汉字里，都藏着一个世界",
    "A tree. An eye. A heart. A thought. Discover how Chinese characters connect.":
      "一棵树、一只眼、一颗心，组成一个念头。来探索汉字之间的联系。",
    "Tree plus eye plus heart becomes thought": "木加目加心，组成想",
    "Game mode": "游戏模式",
    Explore: "自由探索",
    "Timed challenge": "限时挑战",
    "A little pressure. A lot of possibility.": "一点时间压力，无限组字可能。",
    "No clock. Just curiosity.": "没有倒计时，只有好奇。",
    Pinyin: "拼音",
    "Run controls": "回合控制",
    "READY WHEN YOU ARE": "准备好就开始",
    "TAKE A BREATH": "稍作休息",
    "A LITTLE MORE DISCOVERED": "又多发现了一些",
    "60 seconds. How much will you discover?": "60 秒内，你能发现多少？",
    "Your table is waiting.": "牌桌正等着你。",
    "A full tray. A fresh start?": "字盘已满，要重新开始吗？",
    "Time’s up. Nicely explored.": "时间到，探索得真不错。",
    "8 starting tiles. A new one every 6 seconds. Make space before the 13th arrives.":
      "从 8 张字牌开始，每 6 秒加入一张。第 13 张到来前记得腾出空间。",
    "The clock and incoming tiles are paused.": "倒计时和新字牌都已暂停。",
    "Start challenge →": "开始挑战 →",
    "Keep playing →": "继续游戏 →",
    "New run →": "重新开始 →",
    "Challenge status": "挑战状态",
    "TIME LEFT": "剩余时间",
    SCORE: "分数",
    "SESSION BEST": "本次最高分",
    Resume: "继续",
    Pause: "暂停",
    "Character board": "汉字区",
    "Your character board": "你的汉字区",
    "{count} characters": "{count} 个汉字",
    "Click a character to unfold it into its parts.":
      "点击汉字，将它拆解成组成部分。",
    "Your next discovery belongs here.": "下一个新发现会出现在这里。",
    "Combine two or three tiles from the tray below.":
      "从下方字盘选择两到三张字牌来组合。",
    "Made characters stay here. Split them to reuse their parts.":
      "组成的汉字会留在这里。拆解它们，就能重用各个部分。",
    "Unfold one tile at a time. Use + to select a tray tile intact.":
      "每次拆解一张字牌。使用 + 可直接选择字盘中的完整字牌。",
    Undo: "撤销",
    "Component tray": "部件字盘",
    "Your component tray": "你的部件字盘",
    "{count} tiles": "{count} 张字牌",
    "Drag a tile onto another to combine. On touch screens, use the dotted grip. Click to unfold; use + to select.":
      "将一张字牌拖到另一张上即可组合。触摸屏请拖动点状把手。点击可拆解；使用 + 可选择完整字牌。",
    "Next tile in {seconds}s": "下一张字牌将在 {seconds} 秒后加入",
    "Selected components": "已选部件",
    "A new possibility?": "会组成什么呢？",
    "Pick two pieces": "选择两个部件",
    "Hide combination hints": "隐藏组字提示",
    "Highlight all tiles with a valid combination partner":
      "标记所有可与其他字牌组合的字牌",
    Hint: "提示",
    Combine: "组合",
    "Tile set": "字牌组合",
    "Reset table": "重置字桌",
    "Add a character": "添加汉字",
    "Try a character: 好": "试试输入汉字：好",
    "Character field guide": "汉字小指南",
    "THE FIELD GUIDE": "汉字小指南",
    "Pronunciation unavailable": "暂无读音资料",
    "A character to explore": "等你探索的汉字",
    "Every piece is a place to begin.": "每个部件都是探索的起点。",
    "LOOK INSIDE": "看看组成",
    "A SINGLE PIECE": "单个汉字",
    "Learn about {char}": "查看“{char}”的资料",
    "No supported split in our dictionary. This tile may still be a part of another character.":
      "字典中没有支持的拆解方式，但这个字仍可能是其他汉字的部件。",
    "GOOD TO KNOW": "小知识",
    "Parts sometimes change shape inside a character. ":
      "部件在汉字中有时会变形。例如",
    " — we keep the full character on your tile.":
      "会写成忄；字牌上仍会显示完整的心字。",
    "YOUR SMALL COLLECTION": "你的汉字收藏",
    "Made by you": "由你组成",
    "Every character you create becomes a little discovery.":
      "你组成的每个汉字，都是一个新发现。",
    "Your first one is just two tiles away.":
      "再组合两张字牌，就能有第一个新发现。",
    "Cancel composition": "取消组合",
    "Which character will you make?": "你想组成哪个汉字？",
    " can become ": " 可以组成 ",
    " different characters. Choose one.": " 个不同的汉字。请选择一个。",
    "Definition unavailable": "暂无字义资料",
    "Keep my tiles": "保留当前字牌",
    "WELCOME TO XIANG": "欢迎来到 Xiang",
    "Close instructions": "关闭说明",
    "Characters are made of possibilities.": "汉字里藏着各种可能。",
    "Take one apart.": "拆解汉字。",
    "Make something new.": "组成新字。",
    "Follow your curiosity.": "跟着好奇心探索。",
    "Let’s explore →": "开始探索 →",
    "Start with 想. Click it to discover what’s inside.":
      "从想开始。点击它，看看里面有哪些部件。",
    "Start with {char}. Click it to discover what’s inside.":
      "从 {char} 开始。点击它，看看里面有哪些部件。",
    "Build characters. Make room. Keep the clock alive.":
      "组字、腾出空间，让倒计时继续。",
    "Select two components, then combine them.": "选择两个部件，再将它们组合。",
    "Combine up to three tiles. Deselect a tile first.":
      "最多可组合三张字牌。请先取消一张字牌的选择。",
    "Last move undone.": "已撤销上一步。",
    "Combination hints hidden.": "已隐藏组字提示。",
    "{count} tiles have at least one valid combination. Hints don’t show which pieces match.":
      "有 {count} 张字牌至少能组成一个有效汉字。提示不会指出哪些字牌彼此配对。",
    "No combination yet. Unfold a tile or wait for a new component.":
      "目前无法组合。试着拆解一张字牌，或等候新的部件。",
    "Select up to three tiles. Deselect one to change the combination.":
      "最多选三张字牌。取消选择一张即可更改组合。",
    "Your pieces, a new possibility. Try Combine.":
      "部件已备好，试试点击“组合”。",
    "Choose one more component from the tray.": "再从字盘选择一个部件。",
    "{char} has no usable one-level split in this dictionary.":
      "字典中没有可用的“{char}”一阶拆解方式。",
    "Combine some tray tiles first (48-tile limit).":
      "请先组合一些字牌（上限为 48 张）。",
    "{char} → {children}. The pieces are in your tray.":
      "{char} → {children}。部件已放入字盘。",
    "Enter one Chinese character from the dictionary.":
      "请输入一个字典中收录的汉字。",
    "Split a board character first (24-character limit).":
      "请先拆解一个汉字（上限为 24 个）。",
    "Added {char}. Click it to explore its components.":
      "已添加 {char}。点击它即可探索组成部件。",
    "Added {char}. This character has no usable one-level split.":
      "已添加 {char}。这个汉字没有可用的一阶拆解方式。",
    "No match for {pair} in this dictionary. Try another pair.":
      "字典中找不到 {pair} 的组合。请试试其他部件。",
    "{pair} → {char} · New discovery!": "{pair} → {char} · 新发现！",
    "{pair} → {char} · Nicely done.": "{pair} → {char} · 做得好。",
    " +{points} points · +3 seconds": " +{points} 分 · +3 秒",
    "Character data by ": "汉字数据来源：",
    "MORE THAN ONE POSSIBILITY": "不止一种可能",
    "Combine two or three tray tiles (use + to keep a tile intact), then Combine. If there’s more than one result, you choose. You can also drag one tile onto another; drag a selected pair onto a third tile for three-piece recipes. On touch screens, drag the dotted grip. Press Escape to cancel. Invalid combinations keep your tiles.":
      "选择两到三张字盘字牌（使用 + 可保留完整字牌），再点击“组合”。若有多种结果，可自行选择。也可以将一张字牌拖到另一张上；若要组成三部件汉字，请将已选的一对拖到第三张上。触摸屏请拖动点状把手。按 Escape 取消。无效组合不会消耗字牌。",
    "Explore freely, or try the timed challenge: 60 seconds, a new tile every 6 seconds, and a 12-tile tray. Each composition adds 3 seconds and 1 point, plus 1 point for a new character. A 13th tile ends the run—even when splitting a board character.":
      "自由探索，或试试限时挑战：时间为 60 秒，每 6 秒加入一张新字牌，字盘最多容纳 12 张。每次组合可增加 3 秒和 1 分；首次组成新汉字再加 1 分。若第 13 张字牌加入，挑战就会结束，即使它是拆解汉字所得也一样。",
    "These are structural dictionary relationships, not always the historical origins of a character. Tile order doesn’t matter. Only complete, supported recipes are used, including reviewed three-piece splits such as 森 → 木 + 木 + 木.":
      "这些是字典中的结构关系，不一定代表汉字的历史字源。组合时部件顺序不限。游戏只使用完整且受支持的拆解方式，包括已审核的三部件拆解，例如 森 → 木 + 木 + 木。",
    "A little play. A different way to see.": "一点玩心，换个角度看汉字。",
    "Physical playground": "物理游乐场",
    "Back to the game ↗": "回到游戏 ↗",
    "Pull it apart. Bring it back together.": "拆开它，再把它组回来。",
    "Character gameboard": "汉字游戏区",
    "Physical {board} playground in {style} surface style. Drag a mapped ink component while its source tile and remaining strokes stay in place. As soon as the component clears its source tile, it becomes a new tile that follows the held strokes until release, even if other tiles are nearby. Drag ink on a character without a supported decomposition to move the tile and ink together. Drag a blank tile face to move the whole character. Overlap compatible tile faces, or hold a detachable piece's ink over the compatible tile, to recombine.":
      "{board}的物理游乐场，使用{style}表面。拖动有对应拆解方式的笔画部件时，原字牌和其余笔画会留在原位；部件一离开原字牌，就会成为新字牌并跟随手指直到松开，即使附近还有其他字牌也一样。若汉字没有受支持的拆解方式，拖动笔画会连同字牌一起移动。拖动空白牌面也可移动整个汉字。让相容字牌重叠，或将可拆离部件的笔画拖到相容字牌上，即可重新组合。",
    "The character outlines couldn’t load.": "汉字笔画外框加载失败。",
    "The characters are taking shape…": "汉字正在成形……",
    "A little give. A little gravity.": "一点弹性，一点重力。",
    "Playground controls": "游乐场控制项",
    "HOW TO PLAY": "玩法说明",
    "Pull, place, recombine": "拉开、摆放、重新组合",
    "Start with five characters. Pull a mapped stroke group away. The rest stays in place; as soon as the component clears its source tile, both pieces become tiles and the pulled tile follows your finger until release. Other tiles do not need to be moved out of the way. On characters without a supported decomposition, dragging the strokes moves the tile and ink together. Overlap compatible tiles to recombine them, or hold a detachable piece's ink over the compatible tile to guide it into place.":
      "从五个汉字开始。拉开有对应拆解方式的笔画组，其余部分会留在原位；部件一离开原字牌，两部分就会成为字牌，且被拉动的字牌会跟随手指直到松开。即使附近还有其他字牌，也不必先移开。没有受支持拆解方式的汉字，拖动笔画时会连同字牌一起移动。让相容字牌重叠即可重新组合；也可将可拆离部件的笔画停在相容字牌上方，引导它就位。",
    "Double-tap a character or one of its strokes to unfold one supported step.":
      "双击汉字或其中一组笔画，即可拆解一个受支持的步骤。",
    "Drag a blank tile face to move the whole character. Fixed keeps it centered; Weighted gives it more movement.":
      "拖动空白牌面可移动整个汉字。“固定”会让汉字留在中央；“有重量”则会让它带有阻力地移动。",
    "Add any drawable dictionary character to keep building the board, or explore it alone to replace the current scene.":
      "可添加任何有笔画数据的字典汉字，继续扩展游戏区；也可以单独探索一个汉字，替换当前场景。",
    "IN FOCUS": "当前焦点",
    "Loading definition…": "正在加载字义……",
    "Starting board": "起始游戏区",
    "Five starters": "五个起始汉字",
    "Try a character": "试试一个汉字",
    "Any dictionary character": "任一字典汉字",
    "Loading…": "加载中……",
    "Add to board": "添加到游戏区",
    "Thousands of": "数千种",
    "glyph outlines load only when needed.": "种字形外框会在需要时才加载。",
    "HSK 1 character set": "HSK 1 汉字表",
    "HSK 1 characters": "HSK 1 汉字",
    "Writing system": "书写系统",
    Simplified: "简体中文",
    Traditional: "繁体中文",
    "Loading HSK 1…": "正在加载 HSK 1……",
    "The HSK 1 character list could not be loaded.": "无法加载 HSK 1 汉字表。",
    Retry: "重试",
    "drawable characters": "个可绘制汉字",
    "without stroke outlines": "个没有笔画外框",
    "Add {char} from HSK 1": "从 HSK 1 添加 {char}",
    "Click a character to add it to the current board. HSK 2.0 list.":
      "点击汉字即可添加到当前游戏区。采用 HSK 2.0 汉字表。",
    Source: "来源",
    "MIT license": "MIT 许可证",
    "Character weight": "汉字重量",
    Fixed: "固定",
    "stays centered": "保持在中央",
    Weighted: "有重量",
    "moves with resistance": "带有阻力地移动",
    "Tile interaction": "字牌互动",
    "Tile repulsion": "字牌互斥",
    "loose faces nudge apart": "松动的牌面会轻轻推开彼此",
    "Pop sound when a component tears free": "部件撕离时播放啵的一声",
    "Tile tools": "字牌工具",
    "Arrange mode": "排列方式",
    "Arrange tiles": "排列字牌",
    "Blast!": "炸开字牌！",
    Shuffle: "洗牌",
    "Keep arranged": "保持排列",
    "Re-run this arrange mode whenever new tiles are added.":
      "新增字牌时，重新应用此排列方式。",
    "One at a time": "逐一移动",
    "All at once": "同时移动",
    "Group by shared components": "按共有部件分组",
    "Snap to grid when released": "松开时吸附至网格",
    "Highlight compatible tiles": "标示可组合字牌",
    "Hide tile hints": "隐藏字牌提示",
    "{count} compatible tiles highlighted": "已标示 {count} 张可组合字牌",
    "No compatible loose tiles for this character.":
      "目前没有可与此字组合的独立字牌。",
    "Surface style": "表面样式",
    Flat: "平面",
    "ink only": "只有笔画",
    Raised: "浮雕",
    embossed: "凸起效果",
    Draped: "垂挂",
    "over the edge": "垂过边缘",
    Silk: "丝",
    "down to the table": "垂落桌面",
    "Game board": "游戏棋盘",
    "Bamboo table": "竹桌",
    "Single slate slab": "整块石板",
    "Traditional Go board · 19×19": "传统木制围棋盘 · 19×19",
    "Compact Go board · 9×9": "小型围棋盘 · 9×9",
    "Rice-paper scroll": "宣纸卷轴",
    "Physics controls": "物理效果控制",
    Softness: "柔软度",
    Still: "静止",
    Firm: "坚实",
    Floppy: "柔软",
    Supple: "有弹性",
    "Give it a nudge": "轻推一下",
    Reset: "重置",
    "Reduce motion": "减少动态效果",
    "Keyboard: arrows to nudge · R to reset · F for fullscreen · Escape to release.":
      "键盘：方向键轻推 · R 重置 · F 全屏 · Escape 松开。",
    "Reviewed outlines and component matches: ": "已审核的笔画外框和部件匹配：",
    "Arphic Public License": "Arphic 公共许可证",
    "Enter one Chinese character.": "请输入一个汉字。",
    "No usable drawing data was found for {char}. Try another dictionary character.":
      "找不到“{char}”可用的笔画数据。请试试其他字典汉字。",
    "Five starters are ready. Pull a component away from any character to explore it.":
      "五个起始汉字已就绪。从任一汉字拉出部件来探索。",
    "Pull a component outward. Stretch its seam to tear it free.":
      "向外拉动部件。拉开接缝即可撕离。",
    "Pull {part} away. The rest stays in place.":
      "拉开 {part}。其余部分会留在原位。",
    "Move a tile to make room for both components.":
      "移动字牌，为两个部件腾出空间。",
    "Finish the current drag before adding a character.":
      "请先完成当前拖动，再添加汉字。",
    "Finish the current drag before unfolding a tile.":
      "请先完成当前拖动，再拆解字牌。",
    "This character has no reviewed physical decomposition yet.":
      "这个汉字尚无经审核的物理拆解数据。",
    "Some character outlines could not be loaded. Try selecting that character again.":
      "部分汉字外框无法加载。请重新选择该汉字。",
    "Component strokes are ready for {chars}. Pull one to continue.":
      "{chars} 的部件笔画已就绪。拉动其中一个即可继续。",
    "Loading component strokes for {chars}…": "正在加载 {chars} 的部件笔画……",
    "{char} has an outline, but no complete physical component mapping yet.":
      "“{char}”有笔画外框，但尚无完整的物理部件对应数据。",
    "{char} added as a new tile. Pull a component or combine it with another character.":
      "已将“{char}”添加为新字牌。拉出部件，或与其他汉字组合。",
    "There isn’t room for another tile. Move a tile and try again.":
      "空间不足，无法再添加字牌。请移动一张字牌后重试。",
    "Keep pulling until the component clears its source tile.":
      "继续拉动，直到部件离开原字牌。",
    "Guide the pulled component back inside the board before it separates.":
      "在部件分离前，请将它移回游戏区内。",
    "Guide both pieces back inside the board before they separate.":
      "请先将两个部件移回游戏区，再让它们分离。",
    "The dictionary couldn’t load. Please reload to try again.":
      "字典加载失败，请重新加载再试一次。",
    "Loading character data…": "正在加载汉字数据……",
    "complete decompositions": "个完整拆解",
    "ordered pair entries": "组有序配对",
    "A CLOSER LOOK AT THE PIECES": "深入看看汉字部件",
    "The dictionary lab.": "字典实验室。",
    "Explore the same supported relationships that make the game work.":
      "探索游戏中使用的汉字结构关系。",
    "01 / TAKE APART": "01 / 拆解",
    "Inside a character": "汉字的组成",
    Character: "汉字",
    "Normalized: ": "规范化后：",
    "No supported decomposition found.": "找不到受支持的拆解方式。",
    "02 / PUT TOGETHER": "02 / 组合",
    "Find a new character": "找出可组成的汉字",
    "Component A": "部件 A",
    "Component B": "部件 B",
    "Component C (optional)": "部件 C（选填）",
    "For three-piece recipes": "用于三部件组合",
    "No matching composition found.": "找不到匹配的组合。",
    "Order doesn’t matter. Select a result to look inside it.":
      "部件顺序不限。选择结果即可查看其组成。",
    "{count} starter characters": "{count} 个起始汉字",
    "{count} custom characters": "{count} 个自选汉字",
    "THE PLAYGROUND / PHYSICS LAB": "物理游乐场／实验室",
    "Character details for {char}": "“{char}”的汉字资料",
    "Loading pronunciation…": "正在加载读音……",
    Add: "添加",
    "{count} glyph outlines load only when needed.":
      "{count} 个字形外框会在需要时才加载。",
    "Frequency: ": "出现频率：",
    "Xiang runs in your browser. Its application code does not create accounts, send game actions to a server, set or read cookies, store gameplay activity, or load analytics or advertising scripts. Your game state stays in memory for the current page visit and resets when you reload. Your chosen language preference is stored locally in your browser and is not sent to Xiang servers.":
      "Xiang 在你的浏览器中运行。应用程序不会创建账号、不会将游戏操作发送到服务器、不会设置或读取 Cookie、不会存储游戏活动，也不会加载分析或广告脚本。游戏状态只保留在当前页面的内存中，重新加载后会重置。你选择的语言会保存在浏览器本地，不会发送到 Xiang 服务器。",
    "The site is hosted by GitHub Pages. GitHub says it logs and stores visitors’ IP addresses for security purposes. GitHub handles that information under its own privacy practices. Read the ":
      "本网站由 GitHub Pages 托管。GitHub 表示，为了安全目的会记录并保存访客的 IP 地址，并按照自身的隐私政策处理这些信息。请参阅",
    whole: "完整",
    stretching: "拉伸中",
    loose: "已分离",
    "Time’s up. Every discovery counts.": "时间到，每个新发现都值得庆祝。",
    "The tray filled up. Give it another try.": "字盘已满，再试一次吧。",
    "{char} added as a new tile. It has an outline but no complete physical component mapping.":
      "已将“{char}”添加为新字牌。它有笔画外框，但尚无完整的物理部件对应数据。",
    "{count} drawable characters": "{count} 个可绘制汉字",
    " · {count} without stroke outlines": " · {count} 个没有笔画外框",
    "Thousands of glyph outlines load only when needed.":
      "数千种字形外框会在需要时才加载。",
    "Only complete recipes are kept. Reviewed nested recipes such as 森 → 木 + 木 + 木 are supported; other nested expressions remain excluded. common forms such as 忄 and 氵 normalize to 心 and 水. These structural recipes are not claims about etymology.":
      "只保留完整的拆解规则。已审核的嵌套规则（例如 森 → 木 + 木 + 木）也受支持；其他嵌套结构仍不包含在内。常见部件形式如忄、氵会规范化为心、水。这些结构规则不代表字源考证。",
    "Privacy — Xiang": "隐私 — Xiang",
    "A SMALL, SELF-CONTAINED PROJECT": "一个小型的独立项目",
    "Xiang runs in your browser. Its application code does not create accounts, send game actions to a server, set or read cookies, use browser storage, or load analytics or advertising scripts. Your game state stays in memory for the current page visit and resets when you reload.":
      "Xiang 在你的浏览器中运行。应用程序不会创建账号、不会将游戏操作发送到服务器、不会设置或读取 Cookie，也不会加载分析或广告脚本。游戏状态只保留在当前页面的内存中，重新加载后会重置。所选语言会保存在浏览器的本地存储中。",
    "GitHub says it logs and stores visitors’ IP addresses for security purposes. GitHub handles that information under its own privacy practices.":
      "GitHub 表示，为了安全目的会记录并保存访客的 IP 地址。GitHub 会依照自身的隐私政策处理这些信息。",
    "Read the ": "阅读",
    "GitHub Privacy Statement": "GitHub 隐私声明",
    "Xiang is a personal project by Jason McDowell. For questions, use the ":
      "Xiang 是 Jason McDowell 的个人项目。如有问题，请前往",
    "Xiang project repository": "Xiang 项目仓库",
    "← Back to Xiang": "← 返回 Xiang",
    "← Back to play": "← 返回游戏",
    "Playground games": "游乐场游戏",
    "Discovery Run": "发现之旅",
    "Discovery Run controls": "发现之旅控制项",
    "SURVIVAL GAME": "生存游戏",
    "Make room for discovery": "腾出空间，探索新字",
    "A new character arrives every 10 seconds. Keep the board below its tile limit by tearing characters apart and recombining their pieces. The run ends when the board fills.":
      "每 10 秒会出现一个新汉字。拆解汉字并重新组合部件，让字牌数保持在上限以下。游戏区填满时，本回合结束。",
    "Earn one point for each character delivered and one for every distinct character outside your collection that appears, even if you later recombine it.":
      "每加入一个汉字可得一分；每发现一个不在所选字集中的不同汉字也可得一分，即使之后重新组合仍会保留记录。",
    "Tile collection": "字牌字集",
    "Playground collection": "游乐场字集",
    "HSK 1 Simplified": "HSK 1 简体字",
    "HSK 1 Traditional": "HSK 1 繁体字",
    "Board size": "游戏区大小",
    "{count} spaces · {grid}×{grid}": "{count} 格 · {grid}×{grid}",
    "Tiles are sized to fit the cells and snap into place when released.":
      "字牌会缩放以符合格子，放开时会吸附到格位。",
    "Start Discovery Run": "开始发现之旅",
    "Preparing the board…": "正在准备游戏区……",
    "Choose a collection and board size, then start.":
      "选择字集和游戏区大小，然后开始。",
    "Discovery Run game board": "发现之旅游戏区",
    TILES: "字牌",
    DISCOVERED: "新发现",
    SURVIVED: "存活时间",
    "Next character in {seconds}s": "下一个汉字将在 {seconds} 秒后到来",
    "New tile in {seconds}s": "新字牌将在 {seconds} 秒后到来",
    "{count} new characters": "{count} 个新汉字",
    "RUN COMPLETE": "本回合结束",
    "The board is full.": "游戏区已满。",
    Score: "分数",
    "Run again": "再玩一回合",
    "CURRENT SCORE": "当前分数",
    delivered: "已加入",
    discoveries: "个新发现",
    "Board capacity": "字牌上限",
    "DISCOVERED CHARACTERS": "已发现的汉字",
    "New characters discovered": "新发现的汉字",
    "Pull apart a character to make your first discovery.":
      "拆解汉字，寻找第一个新发现。",
    "Pause and return to Playground": "暂停并返回物理游乐场",
    "Switching to Playground pauses the arrival clock. Your run and score stay here when you return.":
      "切换到物理游乐场时，新字牌的倒计时会暂停。返回后可继续当前回合和分数。",
    "Character strokes load as they are needed.": "汉字笔画会在需要时加载。",
    "A tile could not be loaded from this collection. The run is still going.":
      "无法加载此字集中的字牌。本回合会继续。",
    "The run is on. A new character arrives every 10 seconds.":
      "本回合开始。每 10 秒会出现一个新汉字。",
  },
};

export function translate(
  language: SiteLanguage,
  source: string,
  values?: Record<string, string | number>,
): string {
  let result = language === "en" ? source : (copy[language][source] ?? source);
  if (values)
    for (const [name, value] of Object.entries(values))
      result = result.replaceAll(`{${name}}`, String(value));
  return result;
}

export function translateRuntimeText(
  language: SiteLanguage,
  source: string,
): string {
  if (language === "en") return source;
  const t = (key: string, values?: Record<string, string | number>) =>
    translate(language, key, values);
  let match = source.match(
    /^Start with (.+)\. Click it to discover what’s inside\.$/,
  );
  if (match)
    return t("Start with {char}. Click it to discover what’s inside.", {
      char: match[1],
    });
  match = source.match(
    /^Component strokes are ready for (.+)\. Pull one to continue\.$/,
  );
  if (match)
    return t("Component strokes are ready for {chars}. Pull one to continue.", {
      chars: match[1],
    });
  match = source.match(/^Loading component strokes for (.+)…$/);
  if (match)
    return t("Loading component strokes for {chars}…", { chars: match[1] });
  match = source.match(
    /^No usable drawing data was found for (.+)\. Try another dictionary character\.$/,
  );
  if (match)
    return t(
      "No usable drawing data was found for {char}. Try another dictionary character.",
      { char: match[1] },
    );
  match = source.match(/^Pull (.+) away\. The rest stays in place\.$/);
  if (match)
    return t("Pull {part} away. The rest stays in place.", {
      part: match[1],
    });
  match = source.match(
    /^(.+) has an outline, but no complete physical component mapping yet\.$/,
  );
  if (match)
    return t(
      "{char} has an outline, but no complete physical component mapping yet.",
      { char: match[1] },
    );
  match = source.match(
    /^(.+) added as a new tile\. Pull a component or combine it with another character\.$/,
  );
  if (match)
    return t(
      "{char} added as a new tile. Pull a component or combine it with another character.",
      { char: match[1] },
    );
  match = source.match(
    /^(.+) added as a new tile\. It has an outline but no complete physical component mapping\.$/,
  );
  if (match)
    return t(
      "{char} added as a new tile. It has an outline but no complete physical component mapping.",
      { char: match[1] },
    );
  match = source.match(/^(.+) has no reviewed physical decomposition yet\.$/);
  if (match)
    return t("{char} has no reviewed physical decomposition yet.", {
      char: match[1],
    });
  match = source.match(
    /^(.+) has no usable one-level split in this dictionary\.$/,
  );
  if (match)
    return t("{char} has no usable one-level split in this dictionary.", {
      char: match[1],
    });
  match = source.match(/^(.+) → (.+)\. The pieces are in your tray\.$/);
  if (match)
    return t("{char} → {children}. The pieces are in your tray.", {
      char: match[1],
      children: match[2],
    });
  match = source.match(
    /^No match for (.+) in this dictionary\. Try another pair\.$/,
  );
  if (match)
    return t("No match for {pair} in this dictionary. Try another pair.", {
      pair: match[1],
    });
  match = source.match(/^(.+) → (.+) · (New discovery!|Nicely done\.)(.*)$/);
  if (match) {
    const isNew = match[3] === "New discovery!";
    const points = match[4].match(/\+(\d+) points · \+(\d+) seconds/);
    const suffix = points
      ? t(" +{points} points · +3 seconds", { points: points[1] })
      : "";
    return (
      t(
        isNew
          ? "{pair} → {char} · New discovery!"
          : "{pair} → {char} · Nicely done.",
        {
          pair: match[1],
          char: match[2],
        },
      ) + suffix
    );
  }
  match = source.match(
    /^Added (.+)\. (Click it to explore its components\.|This character has no usable one-level split\.)$/,
  );
  if (match)
    return t(
      match[2].startsWith("Click")
        ? "Added {char}. Click it to explore its components."
        : "Added {char}. This character has no usable one-level split.",
      { char: match[1] },
    );
  match = source.match(
    /^(\d+) tiles have at least one valid combination\. Hints don’t show which pieces match\.$/,
  );
  if (match)
    return t(
      "{count} tiles have at least one valid combination. Hints don’t show which pieces match.",
      { count: match[1] },
    );
  return t(source);
}
