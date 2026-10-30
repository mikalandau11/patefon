// Turntable widget for Scriptable
const CLIENT_ID = "__CID__";
const START_RT = "__RT__";
const SITE = "__URL__";
const KEY = "turntable_rt_" + START_RT.slice(-10);

async function getToken() {
  const rt = Keychain.contains(KEY) ? Keychain.get(KEY) : START_RT;
  const r = new Request("https://accounts.spotify.com/api/token");
  r.method = "POST";
  r.headers = { "Content-Type": "application/x-www-form-urlencoded" };
  r.body = "grant_type=refresh_token&refresh_token=" + encodeURIComponent(rt) + "&client_id=" + CLIENT_ID;
  const d = await r.loadJSON();
  if (!d.access_token) throw new Error("login");
  Keychain.set(KEY, d.refresh_token || rt);
  return d.access_token;
}

async function nowPlaying(at) {
  const r = new Request("https://api.spotify.com/v1/me/player/currently-playing");
  r.headers = { Authorization: "Bearer " + at };
  const txt = await r.loadString();
  if (!r.response || r.response.statusCode !== 200 || !txt) return null;
  const d = JSON.parse(txt);
  if (!d.item) return null;
  const imgs = d.item.album ? d.item.album.images : [];
  return {
    name: d.item.name,
    artist: d.item.artists.map(a => a.name).join(", "),
    img: (imgs[1] || imgs[0] || {}).url,
  };
}

// תקליט שחור עם העטיפה במרכז וזרוע כסופה
function record(cover, size) {
  const ctx = new DrawContext();
  ctx.size = new Size(size, size);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const c = size / 2, R = size * 0.44, L = R * 0.38;
  const black = new Color("#0c0c0d");
  ctx.setFillColor(black);
  ctx.fillEllipse(new Rect(c - R, c - R, 2 * R, 2 * R));
  if (cover) {
    ctx.drawImageInRect(cover, new Rect(c - L, c - L, 2 * L, 2 * L));
    const w = L * 0.5; // טבעת שחורה שמעגלת את פינות העטיפה
    ctx.setStrokeColor(black);
    ctx.setLineWidth(w);
    ctx.strokeEllipse(new Rect(c - L - w / 2, c - L - w / 2, 2 * L + w, 2 * L + w));
  } else {
    ctx.setFillColor(new Color("#e8689d"));
    ctx.fillEllipse(new Rect(c - L, c - L, 2 * L, 2 * L));
  }
  ctx.setLineWidth(1);
  ctx.setStrokeColor(new Color("#ffffff", 0.09));
  for (let r = L * 1.55; r < R * 0.97; r += size * 0.02) {
    ctx.strokeEllipse(new Rect(c - r, c - r, 2 * r, 2 * r));
  }
  const h = size * 0.018;
  ctx.setFillColor(black);
  ctx.fillEllipse(new Rect(c - h, c - h, 2 * h, 2 * h));
  // זרוע
  const px = size * 0.9, py = size * 0.1;
  const arm = new Path();
  arm.move(new Point(px, py));
  arm.addLine(new Point(size * 0.7, size * 0.7));
  ctx.addPath(arm);
  ctx.setStrokeColor(new Color("#e4e4ea"));
  ctx.setLineWidth(size * 0.028);
  ctx.strokePath();
  ctx.setFillColor(new Color("#c9c9cf"));
  ctx.fillEllipse(new Rect(px - size * 0.065, py - size * 0.065, size * 0.13, size * 0.13));
  ctx.setFillColor(new Color("#1d1d20"));
  ctx.fillRect(new Rect(size * 0.665, size * 0.67, size * 0.07, size * 0.1));
  return ctx.getImage();
}

// רקע: העטיפה מוקטנת ומוגדלת (נראה מטושטש) עם שכבה כהה
function background(cover) {
  const tiny = new DrawContext();
  tiny.size = new Size(10, 10);
  tiny.respectScreenScale = false;
  tiny.drawImageInRect(cover, new Rect(0, 0, 10, 10));
  const ctx = new DrawContext();
  ctx.size = new Size(400, 400);
  ctx.drawImageInRect(tiny.getImage(), new Rect(-40, -40, 480, 480));
  ctx.setFillColor(new Color("#000000", 0.35));
  ctx.fillRect(new Rect(0, 0, 400, 400));
  return ctx.getImage();
}

async function build() {
  const w = new ListWidget();
  w.url = SITE;
  w.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);
  const g = new LinearGradient();
  g.colors = [new Color("#3a1a2b"), new Color("#140a10")];
  g.locations = [0, 1];
  w.backgroundGradient = g;

  let t = null, cover = null, msg = null;
  try {
    const at = await getToken();
    t = await nowPlaying(at);
    if (t && t.img) cover = await new Request(t.img).loadImage();
  } catch (e) {
    msg = "צריך להכין קוד חדש באתר";
  }
  if (cover) w.backgroundImage = background(cover);

  const title = msg || (t ? t.name : "אין שיר מתנגן");
  const sub = msg ? "" : (t ? t.artist : "הפעילי שיר בספוטיפיי");
  const family = config.widgetFamily || "medium";

  if (family === "small") {
    w.setPadding(10, 10, 10, 10);
    const row = w.addStack(); row.addSpacer();
    const im = row.addImage(record(cover, 200)); im.imageSize = new Size(100, 100);
    row.addSpacer();
    w.addSpacer(4);
    const tt = w.addText(title); tt.font = Font.boldSystemFont(12); tt.textColor = Color.white(); tt.lineLimit = 1; tt.centerAlignText();
  } else {
    w.setPadding(12, 14, 12, 14);
    const row = w.addStack();
    row.layoutHorizontally();
    row.centerAlignContent();
    const im = row.addImage(record(cover, 260)); im.imageSize = new Size(130, 130);
    row.addSpacer(12);
    const col = row.addStack();
    col.layoutVertically();
    const tt = col.addText(title); tt.font = Font.boldSystemFont(17); tt.textColor = Color.white(); tt.lineLimit = 2;
    col.addSpacer(4);
    const st = col.addText(sub); st.font = Font.systemFont(13); st.textColor = new Color("#ffffff", 0.75); st.lineLimit = 2;
    row.addSpacer();
  }
  return w;
}

const widget = await build();
if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentMedium();
Script.complete();
