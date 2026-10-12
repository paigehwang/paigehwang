// 가나 → 한글 발음 표기 (초급자용 근사치)
const Kana = (() => {
  const single = {
    あ: "아", い: "이", う: "우", え: "에", お: "오",
    か: "카", き: "키", く: "쿠", け: "케", こ: "코", が: "가", ぎ: "기", ぐ: "구", げ: "게", ご: "고",
    さ: "사", し: "시", す: "스", せ: "세", そ: "소", ざ: "자", じ: "지", ず: "즈", ぜ: "제", ぞ: "조",
    た: "타", ち: "치", つ: "츠", て: "테", と: "토", だ: "다", ぢ: "지", づ: "즈", で: "데", ど: "도",
    な: "나", に: "니", ぬ: "누", ね: "네", の: "노",
    は: "하", ひ: "히", ふ: "후", へ: "헤", ほ: "호", ば: "바", び: "비", ぶ: "부", べ: "베", ぼ: "보",
    ぱ: "파", ぴ: "피", ぷ: "푸", ぺ: "페", ぽ: "포",
    ま: "마", み: "미", む: "무", め: "메", も: "모",
    や: "야", ゆ: "유", よ: "요",
    ら: "라", り: "리", る: "루", れ: "레", ろ: "로",
    わ: "와", を: "오", ゔ: "부",
    ぁ: "아", ぃ: "이", ぅ: "우", ぇ: "에", ぉ: "오", ゃ: "야", ゅ: "유", ょ: "요", ゎ: "와",
  };
  const combo = {
    きゃ: "캬", きゅ: "큐", きょ: "쿄", ぎゃ: "갸", ぎゅ: "규", ぎょ: "교",
    しゃ: "샤", しゅ: "슈", しょ: "쇼", じゃ: "자", じゅ: "주", じょ: "조", しぇ: "셰", じぇ: "제",
    ちゃ: "차", ちゅ: "추", ちょ: "초", ちぇ: "체",
    にゃ: "냐", にゅ: "뉴", にょ: "뇨", ひゃ: "햐", ひゅ: "휴", ひょ: "효",
    びゃ: "뱌", びゅ: "뷰", びょ: "뵤", ぴゃ: "퍄", ぴゅ: "퓨", ぴょ: "표",
    みゃ: "먀", みゅ: "뮤", みょ: "묘", りゃ: "랴", りゅ: "류", りょ: "료",
    ふぁ: "화", ふぃ: "휘", ふぇ: "훼", ふぉ: "훠", てぃ: "티", でぃ: "디", とぅ: "투",
    うぃ: "위", うぇ: "웨", うぉ: "워", ゔぁ: "바",
  };
  const toHira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const addJong = (str, jong) => {
    if (!str) return str;
    const last = str.charCodeAt(str.length - 1) - 0xac00;
    if (last < 0 || last > 11171 || last % 28 !== 0) return str;
    return str.slice(0, -1) + String.fromCharCode(0xac00 + last + jong);
  };
  function toHangul(kana, particles = true) {
    return toHira(kana)
      .split(/(\s+)/)
      .map((tok) => {
        if (particles && tok === "は") return "와";
        if (particles && tok === "へ") return "에";
        tok = tok.replace(/(こんにち|こんばん)は/g, "$1わ");
        let out = "";
        for (let i = 0; i < tok.length; i++) {
          const c = tok[i];
          const two = tok.slice(i, i + 2);
          if (combo[two]) { out += combo[two]; i++; continue; }
          if (c === "っ") { const n = addJong(out, 19); out = n === out ? out : n; continue; }
          if (c === "ん") { const n = addJong(out, 4); out = n !== out ? n : out + "응"; continue; }
          if (c === "ー") continue;
          out += single[c] ?? c;
        }
        return out;
      })
      .join("");
  }
  const rows = [
    ["あいうえお", "a"], ["かきくけこ", "k"], ["さしすせそ", "s"], ["たちつてと", "t"], ["なにぬねの", "n"],
    ["はひふへほ", "h"], ["まみむめも", "m"], ["や　ゆ　よ", "y"], ["らりるれろ", "r"], ["わ　　　を", "w"], ["ん　　　　", ""],
    ["がぎぐげご", "g"], ["ざじずぜぞ", "z"], ["だぢづでど", "d"], ["ばびぶべぼ", "b"], ["ぱぴぷぺぽ", "p"],
  ];
  const toKata = (s) => s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
  return { toHangul, rows, toKata, toHira };
})();
