/**
 * Interface texts. The app is English-only for now (ENABLED below). The Slovak and Ukrainian
 * dictionaries are kept for later: to bring them back, add them to ENABLED, put a language control
 * in Settings, and load a Cyrillic font (Geist Sans has none).
 *
 * Every language must define every key: a missing translation fails the build.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";

export type Lang = "en" | "sk" | "uk";

const ENABLED: readonly Lang[] = ["en"];

const en = {
  "nav.main": "Main",
  "nav.now": "Now",
  "nav.errors": "Top errors",
  "nav.fixes": "Fixes",
  "brand.line": "Line L01",
  "brand.lineDrive": "Line L01 · E-drive",

  "common.close": "Close",
  "common.cancel": "Cancel",
  "common.noData": "No data",

  "unit.pcs": "pcs",
  "unit.pc": "pc",
  "unit.min": "min",
  "unit.pp": "pp",

  "day.Mon": "Mon",
  "day.Tue": "Tue",
  "day.Wed": "Wed",
  "day.Thu": "Thu",
  "day.Fri": "Fri",
  "day.Sat": "Sat",
  "day.Sun": "Sun",

  "settings.title": "Settings",
  "settings.language": "Language",
  "settings.theme": "Theme",
  "theme.auto": "Auto",
  "theme.light": "Light",
  "theme.dark": "Dark",

  "sim.title": "Simulation",
  "sim.intro": "Replays the line data at speed. Every screen shows data up to this moment.",
  "sim.demo": "Start demo",
  "sim.demoHint": "Wed 25 Nov 08:50 · 60× · camera stop at 09:08",
  "sim.time": "Sim time",
  "sim.waiting": "Waiting for the backend",
  "sim.resume": "Resume",
  "sim.pause": "Pause",
  "sim.resumeSim": "Resume simulation",
  "sim.pauseSim": "Pause simulation",
  "sim.speed": "Speed",
  "sim.speedLabel": "Simulation speed",
  "sim.jumpTo": "Jump to",
  "sim.jump": "Jump",

  "greet.morning": "Good morning",
  "greet.afternoon": "Good afternoon",
  "greet.evening": "Good evening",
  "greet.hello": "Hello",

  "status.live": "Live",
  "status.paused": "Paused",
  "status.offline": "Offline",
  "status.connecting": "Connecting",

  "hero.stopped": "Line stopped",
  "hero.running": "Running",
  "hero.since": "since {time}",
  "hero.allRunning": "All stations running",
  "hero.noStopNow": "No stop right now",
  "hero.shiftOee": "Shift OEE",
  "hero.fix": "Recommended fix",
  "hero.lastStop": "Last stop {code} at {time}",
  "hero.noStops": "No stops so far today",

  "kpi.byHour": "By hour",
  "kpi.byHourAria": "OEE by hour, latest {value} percent, target {target} percent",
  "kpi.lost": "Lost today",
  "kpi.of": "of {n}",
  "kpi.ifFixed": "If fixed first",
  "kpi.back": "{n} pcs back",
  "kpi.noStops": "No stops so far.",
  "kpi.noEstimate": "No estimate right now.",
  "legend.stops": "Stops",
  "legend.speed": "Speed",
  "legend.defects": "Defects",
  "legend.good": "Good",
  "kpi.gridAria": "{total} possible pieces: {stop} lost to stops, {speed} to speed, {defect} scrapped",

  "errors.title": "Errors today",
  "errors.empty": "No errors so far today — the line runs clean.",
  "errors.running": "still running",
  "errors.stripAria": "{n} errors across the shift, 06:00 to 14:00",
  "kind.stop": "Stop",
  "kind.defect": "Defect",
  "kind.speed": "Speed loss",

  "coming.title": "Coming up",
  "coming.meta": "next 6 shifts",
  "coming.empty": "No repeating stops expected — nothing to prepare for.",
  "conf.high": "High confidence",
  "conf.medium": "Likely",
  "conf.low": "Possible",
  "until.now": "Now",
  "until.hm": "In {h} h {m} min",
  "until.m": "In {m} min",
  "until.d1": "Tomorrow",
  "until.d": "In {d} days",

  "role.Team leader": "Team leader",
  "role.Maintenance": "Maintenance",
  "role.Quality": "Quality",
  "role.Process engineer": "Process engineer",
  "role.Logistics": "Logistics",
  "blurb.Team leader": "The line and the shift",
  "blurb.Maintenance": "Stations, cameras and tools",
  "blurb.Quality": "Defects and scrap",
  "blurb.Process engineer": "Cycle time and stability",
  "blurb.Logistics": "Parts and material supply",
  "role.title1": "Who's on",
  "role.title2": "the line?",
  "role.hint": "We show your fixes first. Change it anytime from the Now screen.",
  "role.foot": "No account needed · stored only on this phone",
  "role.aria": "Your role",
  "role.viewingAs": "Viewing as {role}. Change role",

  "panel.empty": "No data for this period",
  "panel.error": "Could not load data",
  "panel.retry": "Retry",
  "panel.loading": "Loading",
  "rank.pcsLost": "pcs lost",
  "pattern.aria": "When it happens, by weekday and hour",

  "ask.title": "Ask AI",
  "ask.about": "About {code}",
  "ask.aboutLine": "About the line",
  "ask.dataOnly": "from line data only",
  "ask.button": "Ask about {code}",
  "ask.question": "Your question",
  "ask.followup": "Ask a follow-up…",
  "ask.placeholderCode": "Ask about {code}…",
  "ask.placeholder": "Ask about the line…",
  "ask.send": "Send",
  "ask.intro": "Ask why the line loses output, what to prepare or what a fix is worth. Answers quote only this month's line data.",
  "ask.introRole": "{role} fixes come first.",
  "ask.try": "Try asking",
  "ask.sources": "Sources",
  "ask.typing": "AI is answering",
  "ask.unavailable": "AI is not available right now.",
  "ask.retry": "Try again",
};

export type TKey = keyof typeof en;
type Dict = Record<TKey, string>;

const sk: Dict = {
  "nav.main": "Hlavná navigácia",
  "nav.now": "Teraz",
  "nav.errors": "Top chyby",
  "nav.fixes": "Opravy",
  "brand.line": "Linka L01",
  "brand.lineDrive": "Linka L01 · E-pohon",

  "common.close": "Zavrieť",
  "common.cancel": "Zrušiť",
  "common.noData": "Žiadne údaje",

  "unit.pcs": "ks",
  "unit.pc": "ks",
  "unit.min": "min",
  "unit.pp": "p. b.",

  "day.Mon": "Po",
  "day.Tue": "Ut",
  "day.Wed": "St",
  "day.Thu": "Št",
  "day.Fri": "Pi",
  "day.Sat": "So",
  "day.Sun": "Ne",

  "settings.title": "Nastavenia",
  "settings.language": "Jazyk",
  "settings.theme": "Téma",
  "theme.auto": "Auto",
  "theme.light": "Svetlá",
  "theme.dark": "Tmavá",

  "sim.title": "Simulácia",
  "sim.intro": "Prehráva údaje linky zrýchlene. Každá obrazovka ukazuje údaje do tohto okamihu.",
  "sim.demo": "Spustiť demo",
  "sim.demoHint": "St 25. nov 08:50 · 60× · zastavenie kamery o 09:08",
  "sim.time": "Čas simulácie",
  "sim.waiting": "Čaká sa na server",
  "sim.resume": "Pokračovať",
  "sim.pause": "Pozastaviť",
  "sim.resumeSim": "Pokračovať v simulácii",
  "sim.pauseSim": "Pozastaviť simuláciu",
  "sim.speed": "Rýchlosť",
  "sim.speedLabel": "Rýchlosť simulácie",
  "sim.jumpTo": "Prejsť na",
  "sim.jump": "Prejsť",

  "greet.morning": "Dobré ráno",
  "greet.afternoon": "Dobrý deň",
  "greet.evening": "Dobrý večer",
  "greet.hello": "Dobrý deň",

  "status.live": "Naživo",
  "status.paused": "Pozastavené",
  "status.offline": "Offline",
  "status.connecting": "Pripája sa",

  "hero.stopped": "Linka stojí",
  "hero.running": "V prevádzke",
  "hero.since": "od {time}",
  "hero.allRunning": "Všetky stanice bežia",
  "hero.noStopNow": "Momentálne bez zastavenia",
  "hero.shiftOee": "OEE zmeny",
  "hero.fix": "Odporúčaná oprava",
  "hero.lastStop": "Posledné zastavenie {code} o {time}",
  "hero.noStops": "Dnes zatiaľ bez zastavení",

  "kpi.byHour": "Po hodinách",
  "kpi.byHourAria": "OEE po hodinách, posledná hodnota {value} percent, cieľ {target} percent",
  "kpi.lost": "Stratené dnes",
  "kpi.of": "z {n}",
  "kpi.ifFixed": "Ak opravíte najprv",
  "kpi.back": "{n} ks späť",
  "kpi.noStops": "Zatiaľ bez zastavení.",
  "kpi.noEstimate": "Odhad teraz nie je k dispozícii.",
  "legend.stops": "Zastavenia",
  "legend.speed": "Rýchlosť",
  "legend.defects": "Nepodarky",
  "legend.good": "Dobré",
  "kpi.gridAria": "{total} možných kusov: {stop} stratených zastaveniami, {speed} rýchlosťou, {defect} nepodarkov",

  "errors.title": "Chyby dnes",
  "errors.empty": "Dnes zatiaľ žiadne chyby — linka beží čisto.",
  "errors.running": "stále trvá",
  "errors.stripAria": "Počet chýb počas zmeny od 06:00 do 14:00: {n}",
  "kind.stop": "Zastavenie",
  "kind.defect": "Nepodarok",
  "kind.speed": "Strata rýchlosti",

  "coming.title": "Čo nás čaká",
  "coming.meta": "ďalších 6 zmien",
  "coming.empty": "Neočakávajú sa opakované zastavenia — netreba sa pripravovať.",
  "conf.high": "Vysoká istota",
  "conf.medium": "Pravdepodobné",
  "conf.low": "Možné",
  "until.now": "Teraz",
  "until.hm": "O {h} h {m} min",
  "until.m": "O {m} min",
  "until.d1": "Zajtra",
  "until.d": "O {d} dni",

  "role.Team leader": "Vedúci tímu",
  "role.Maintenance": "Údržba",
  "role.Quality": "Kvalita",
  "role.Process engineer": "Procesný inžinier",
  "role.Logistics": "Logistika",
  "blurb.Team leader": "Linka a zmena",
  "blurb.Maintenance": "Stanice, kamery a nástroje",
  "blurb.Quality": "Chyby a nepodarky",
  "blurb.Process engineer": "Čas cyklu a stabilita",
  "blurb.Logistics": "Diely a zásobovanie materiálom",
  "role.title1": "Kto je",
  "role.title2": "na linke?",
  "role.hint": "Najprv ukážeme vaše opravy. Zmeniť to môžete kedykoľvek na obrazovke Teraz.",
  "role.foot": "Bez účtu · uložené iba v tomto telefóne",
  "role.aria": "Vaša rola",
  "role.viewingAs": "Zobrazenie ako {role}. Zmeniť rolu",

  "panel.empty": "Za toto obdobie nie sú údaje",
  "panel.error": "Údaje sa nepodarilo načítať",
  "panel.retry": "Skúsiť znova",
  "panel.loading": "Načítava sa",
  "rank.pcsLost": "ks strata",
  "pattern.aria": "Kedy sa to stáva, podľa dňa a hodiny",

  "ask.title": "Opýtať sa AI",
  "ask.about": "O {code}",
  "ask.aboutLine": "O linke",
  "ask.dataOnly": "len z údajov linky",
  "ask.button": "Opýtať sa na {code}",
  "ask.question": "Vaša otázka",
  "ask.followup": "Doplňujúca otázka…",
  "ask.placeholderCode": "Opýtajte sa na {code}…",
  "ask.placeholder": "Opýtajte sa na linku…",
  "ask.send": "Odoslať",
  "ask.intro": "Pýtajte sa, prečo linka stráca výrobu, na čo sa pripraviť alebo čo oprava prinesie. Odpovede vychádzajú len z údajov linky za tento mesiac.",
  "ask.introRole": "Opravy pre rolu {role} sú prvé.",
  "ask.try": "Skúste sa opýtať",
  "ask.sources": "Zdroje",
  "ask.typing": "AI odpovedá",
  "ask.unavailable": "AI momentálne nie je dostupná.",
  "ask.retry": "Skúsiť znova",
};

const uk: Dict = {
  "nav.main": "Головна навігація",
  "nav.now": "Зараз",
  "nav.errors": "Топ помилок",
  "nav.fixes": "Виправлення",
  "brand.line": "Лінія L01",
  "brand.lineDrive": "Лінія L01 · Е-привід",

  "common.close": "Закрити",
  "common.cancel": "Скасувати",
  "common.noData": "Немає даних",

  "unit.pcs": "шт",
  "unit.pc": "шт",
  "unit.min": "хв",
  "unit.pp": "в. п.",

  "day.Mon": "Пн",
  "day.Tue": "Вт",
  "day.Wed": "Ср",
  "day.Thu": "Чт",
  "day.Fri": "Пт",
  "day.Sat": "Сб",
  "day.Sun": "Нд",

  "settings.title": "Налаштування",
  "settings.language": "Мова",
  "settings.theme": "Тема",
  "theme.auto": "Авто",
  "theme.light": "Світла",
  "theme.dark": "Темна",

  "sim.title": "Симуляція",
  "sim.intro": "Відтворює дані лінії прискорено. Кожен екран показує дані до цього моменту.",
  "sim.demo": "Запустити демо",
  "sim.demoHint": "Ср 25 лист 08:50 · 60× · зупинка камери о 09:08",
  "sim.time": "Час симуляції",
  "sim.waiting": "Очікування сервера",
  "sim.resume": "Продовжити",
  "sim.pause": "Пауза",
  "sim.resumeSim": "Продовжити симуляцію",
  "sim.pauseSim": "Поставити симуляцію на паузу",
  "sim.speed": "Швидкість",
  "sim.speedLabel": "Швидкість симуляції",
  "sim.jumpTo": "Перейти до",
  "sim.jump": "Перейти",

  "greet.morning": "Доброго ранку",
  "greet.afternoon": "Добрий день",
  "greet.evening": "Добрий вечір",
  "greet.hello": "Вітаю",

  "status.live": "Наживо",
  "status.paused": "Пауза",
  "status.offline": "Офлайн",
  "status.connecting": "Підключення",

  "hero.stopped": "Лінія зупинена",
  "hero.running": "Працює",
  "hero.since": "з {time}",
  "hero.allRunning": "Усі станції працюють",
  "hero.noStopNow": "Зараз зупинок немає",
  "hero.shiftOee": "OEE зміни",
  "hero.fix": "Рекомендоване виправлення",
  "hero.lastStop": "Остання зупинка {code} о {time}",
  "hero.noStops": "Сьогодні зупинок ще не було",

  "kpi.byHour": "По годинах",
  "kpi.byHourAria": "OEE по годинах, останнє значення {value} відсотків, ціль {target} відсотків",
  "kpi.lost": "Втрачено сьогодні",
  "kpi.of": "з {n}",
  "kpi.ifFixed": "Якщо виправити першим",
  "kpi.back": "{n} шт назад",
  "kpi.noStops": "Поки без зупинок.",
  "kpi.noEstimate": "Оцінка зараз недоступна.",
  "legend.stops": "Зупинки",
  "legend.speed": "Швидкість",
  "legend.defects": "Брак",
  "legend.good": "Добрі",
  "kpi.gridAria": "Можливо {total} шт: {stop} втрачено на зупинках, {speed} на швидкості, {defect} браку",

  "errors.title": "Помилки сьогодні",
  "errors.empty": "Сьогодні помилок ще немає — лінія працює чисто.",
  "errors.running": "досі триває",
  "errors.stripAria": "Кількість помилок за зміну з 06:00 до 14:00: {n}",
  "kind.stop": "Зупинка",
  "kind.defect": "Брак",
  "kind.speed": "Втрата швидкості",

  "coming.title": "Очікується",
  "coming.meta": "наступні 6 змін",
  "coming.empty": "Повторних зупинок не очікується — готуватися ні до чого.",
  "conf.high": "Висока впевненість",
  "conf.medium": "Ймовірно",
  "conf.low": "Можливо",
  "until.now": "Зараз",
  "until.hm": "Через {h} год {m} хв",
  "until.m": "Через {m} хв",
  "until.d1": "Завтра",
  "until.d": "Через {d} дн.",

  "role.Team leader": "Бригадир",
  "role.Maintenance": "Обслуговування",
  "role.Quality": "Якість",
  "role.Process engineer": "Інженер-технолог",
  "role.Logistics": "Логістика",
  "blurb.Team leader": "Лінія та зміна",
  "blurb.Maintenance": "Станції, камери й інструменти",
  "blurb.Quality": "Дефекти та брак",
  "blurb.Process engineer": "Час циклу й стабільність",
  "blurb.Logistics": "Деталі та постачання матеріалів",
  "role.title1": "Хто",
  "role.title2": "на лінії?",
  "role.hint": "Спершу покажемо ваші виправлення. Змінити можна будь-коли на екрані «Зараз».",
  "role.foot": "Без облікового запису · зберігається лише на цьому телефоні",
  "role.aria": "Ваша роль",
  "role.viewingAs": "Перегляд як {role}. Змінити роль",

  "panel.empty": "За цей період немає даних",
  "panel.error": "Не вдалося завантажити дані",
  "panel.retry": "Повторити",
  "panel.loading": "Завантаження",
  "rank.pcsLost": "шт втрачено",
  "pattern.aria": "Коли це стається, за днем і годиною",

  "ask.title": "Запитати ШІ",
  "ask.about": "Про {code}",
  "ask.aboutLine": "Про лінію",
  "ask.dataOnly": "лише з даних лінії",
  "ask.button": "Запитати про {code}",
  "ask.question": "Ваше запитання",
  "ask.followup": "Уточнити…",
  "ask.placeholderCode": "Запитайте про {code}…",
  "ask.placeholder": "Запитайте про лінію…",
  "ask.send": "Надіслати",
  "ask.intro": "Запитуйте, чому лінія втрачає випуск, до чого готуватися або що дасть виправлення. Відповіді спираються лише на дані лінії за цей місяць.",
  "ask.introRole": "Виправлення для ролі «{role}» ідуть першими.",
  "ask.try": "Спробуйте запитати",
  "ask.sources": "Джерела",
  "ask.typing": "ШІ відповідає",
  "ask.unavailable": "ШІ зараз недоступний.",
  "ask.retry": "Спробувати ще",
};

const dictionaries: Record<Lang, Dict> = { en, sk, uk };

/** Counted words, by the language's plural rules (Ukrainian and Slovak have more forms than English). */
const plurals: Record<Lang, Record<"events", Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }>> = {
  en: { events: { one: "{n} event", other: "{n} events" } },
  sk: { events: { one: "{n} udalosť", few: "{n} udalosti", other: "{n} udalostí" } },
  uk: { events: { one: "{n} подія", few: "{n} події", many: "{n} подій", other: "{n} події" } },
};

const KEY = "oee-engine.lang";
const EVENT = "oee-engine:lang";

function fromPhone(): Lang {
  const code = (navigator.language || "en").slice(0, 2).toLowerCase() as Lang;
  return ENABLED.includes(code) ? code : "en";
}

let session: Lang | null = null; // the choice, when storage is blocked

/** The active language. Also usable outside components (date and unit formatting). */
export function getLang(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (ENABLED.includes(v as Lang)) return v as Lang;
  } catch {
    /* private mode / storage blocked */
  }
  return session && ENABLED.includes(session) ? session : fromPhone();
}

function fill(text: string, vars?: Record<string, string | number>): string {
  return vars ? text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : text;
}

/** Translate outside React. In components use useT(), which re-renders on a language change. */
export function translate(key: TKey, vars?: Record<string, string | number>): string {
  return fill(dictionaries[getLang()][key], vars);
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** [language, setLanguage]. */
export function useLang(): [Lang, (lang: Lang) => void] {
  const lang = useSyncExternalStore(subscribe, getLang, () => "en" as Lang);
  const setLang = useCallback((next: Lang) => {
    session = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* storage blocked: the choice lasts for this page only */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [lang, setLang];
}

/** t("hero.since", { time }) and t.count("events", 3), in the active language. */
export function useT() {
  const [lang] = useLang();
  const t = (key: TKey, vars?: Record<string, string | number>) => fill(dictionaries[lang][key], vars);
  t.count = (word: "events", n: number) => {
    const forms = plurals[lang][word];
    return fill(forms[new Intl.PluralRules(lang).select(n)] ?? forms.other, { n });
  };
  return t;
}

/** Keeps <html lang> right, so screen readers and the browser's own controls use the language. */
export function useDocumentLang() {
  const [lang] = useLang();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
}
