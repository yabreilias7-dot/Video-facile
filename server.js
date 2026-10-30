const http = require("http");

const KEY = process.env.DID_API_KEY;
const DEFAULT_AVATAR = "https://d-id-public-bucket.s3.us-west-2.amazonaws.com/alice.jpg";
const VOICE = process.env.VOICE || "fr-FR-DeniseNeural";
const API = "https://api.d-id.com/talks";
const REPO = "yabreilias7-dot/Video-facile";
const FREE_PER_DAY = 3;

if (!KEY) { console.error("Il manque DID_API_KEY."); process.exit(1); }

const used = new Map();
function allowed(ip) {
  const k = ip + new Date().toISOString().slice(0, 10);
  const n = used.get(k) || 0;
  if (n >= FREE_PER_DAY) return false;
  used.set(k, n + 1);
  return true;
}

const auth = { Authorization: "Basic " + KEY, "Content-Type": "application/json" };

let cache = { t: 0, list: [] };
async function avatars() {
  if (Date.now() - cache.t < 600000 && cache.list.length) return cache.list;
  try {
    const r = await fetch("https://api.github.com/repos/" + REPO + "/contents/avatars", { headers: { "User-Agent": "video-facile" } });
    const d = await r.json();
    if (Array.isArray(d)) {
      const list = d.filter((f) => /\.(jpe?g|png)$/i.test(f.name)).map((f) => ({ name: f.name, url: f.download_url }));
      if (list.length) cache = { t: Date.now(), list: list };
    }
  } catch (e) {}
  return cache.list.length ? cache.list : [{ name: "Alice", url: DEFAULT_AVATAR }];
}

function json(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}
function body(req) {
  return new Promise((ok, no) => {
    let s = "";
    req.on("data", (c) => { s += c; if (s.length > 20000) req.destroy(); });
    req.on("end", () => { try { ok(JSON.parse(s || "{}")); } catch (e) { no(e); } });
  });
}

const PAGE = String.raw`<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vidéo Facile</title>
<style>
:root{--bg:#F4F3FF;--s:#fff;--ink:#1B1540;--mut:#5E5A80;--acc:#FF4D6D;--line:#D9D6F2;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#130F2B;--s:#1D1840;--ink:#F2F0FF;--mut:#A9A5CF;--acc:#FF6B86;--line:#363066;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,sans-serif;line-height:1.5}
main{max-width:560px;margin:0 auto;padding:28px 18px 48px}
h1{font-size:2.2rem;line-height:1.05;margin:0 0 8px}
h2{font-size:1.1rem;margin:22px 0 10px}
p{color:var(--mut)}
textarea{width:100%;min-height:130px;border:2px solid var(--line);border-radius:16px;padding:14px;font:inherit;font-size:1.05rem;background:var(--s);color:var(--ink)}
button,a.dl{display:block;width:100%;margin-top:16px;border:0;border-radius:16px;padding:16px;font:inherit;font-size:1.15rem;font-weight:700;background:var(--acc);color:#1B1540;cursor:pointer;text-align:center;text-decoration:none}
button:disabled{opacity:.6}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.pick{width:auto;margin:0;padding:0;border:4px solid transparent;border-radius:16px;overflow:hidden;background:var(--s)}
.pick img{width:100%;aspect-ratio:1;object-fit:cover;display:block}
.pick[aria-pressed="true"]{border-color:var(--acc)}
video{width:100%;border-radius:16px;margin-top:20px;background:#000}
#msg{min-height:1.5em;margin-top:12px;font-weight:600}
</style></head><body><main>
<h1>Votre vidéo avec avatar.</h1>
<p>Choisissez un visage, écrivez ce qu’il doit dire. La vidéo se crée ici, sans quitter l’application.</p>
<h2>1. Choisissez un visage</h2>
<div class="grid" id="av"></div>
<h2>2. Écrivez le texte</h2>
<textarea id="t" maxlength="400" placeholder="Exemple : Bonjour, bienvenue à la boutique de Awa. Venez découvrir nos pagnes colorés !"></textarea>
<button id="go">Créer ma vidéo</button>
<div id="msg" role="status"></div>
<div id="out"></div>
</main>
<script>
var go=document.getElementById("go"),msg=document.getElementById("msg"),out=document.getElementById("out"),av=document.getElementById("av"),timer=null,chosen="";
function stop(m){clearTimeout(timer);go.disabled=false;msg.textContent=m||""}
fetch("/api/avatars").then(function(r){return r.json()}).then(function(list){
  list.forEach(function(a,i){
    var b=document.createElement("button");b.className="pick";b.setAttribute("aria-label","Visage "+(i+1));
    var im=document.createElement("img");im.src=a.url;im.alt="";b.appendChild(im);
    b.addEventListener("click",function(){
      chosen=a.url;
      Array.prototype.forEach.call(av.children,function(c){c.setAttribute("aria-pressed","false")});
      b.setAttribute("aria-pressed","true");
    });
    av.appendChild(b);
    if(i===0){chosen=a.url;b.setAttribute("aria-pressed","true")}
  });
}).catch(function(){});
function poll(id,n){
  if(n>60){stop("C’est trop long. Réessayez dans un moment.");return}
  fetch("/api/status?id="+encodeURIComponent(id)).then(function(r){return r.json()}).then(function(d){
    if(d.error){stop(d.error);return}
    if(d.url){
      stop("Votre vidéo est prête.");
      out.innerHTML="";
      var v=document.createElement("video");v.src=d.url;v.controls=true;v.playsInline=true;out.appendChild(v);
      var a=document.createElement("a");a.className="dl";a.href=d.url;a.target="_blank";a.rel="noopener";a.textContent="Télécharger la vidéo";out.appendChild(a);
    } else { msg.textContent="Création en cours…"; timer=setTimeout(function(){poll(id,n+1)},3000) }
  }).catch(function(){stop("Connexion impossible. Vérifiez votre réseau.")});
}
go.addEventListener("click",function(){
  var t=document.getElementById("t").value.trim();
  if(t.length<10){msg.textContent="Écrivez une phrase un peu plus longue.";return}
  go.disabled=true;out.innerHTML="";msg.textContent="Envoi…";
  fetch("/api/create",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:t,avatar:chosen})})
    .then(function(r){return r.json()}).then(function(d){
      if(d.error){stop(d.error);return}
      poll(d.id,0);
    }).catch(function(){stop("Connexion impossible. Vérifiez votre réseau.")});
});
</script></body></html>`;

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(PAGE);
  }

  if (req.method === "GET" && url.pathname === "/api/avatars") {
    return json(res, 200, await avatars());
  }

  if (req.method === "POST" && url.pathname === "/api/create") {
    try {
      const { text, avatar } = await body(req);
      if (!text || text.trim().length < 10) return json(res, 400, { error: "Texte trop court." });
      if (!allowed(req.socket.remoteAddress || "x")) return json(res, 429, { error: "Vous avez utilisé vos 3 vidéos du jour." });
      const list = await avatars();
      const pick = list.find((a) => a.url === avatar) || list[0];
      const r = await fetch(API, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({
          source_url: pick.url,
          script: { type: "text", input: text.trim().slice(0, 400), provider: { type: "microsoft", voice_id: VOICE } },
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.id) return json(res, 502, { error: "Le service d’avatar a refusé la demande." });
      return json(res, 200, { id: d.id });
    } catch (e) { return json(res, 500, { error: "Erreur du serveur." }); }
  }

  if (req.method === "GET" && url.pathname === "/api/status") {
    try {
      const id = url.searchParams.get("id") || "";
      if (!/^[\w-]{5,80}$/.test(id)) return json(res, 400, { error: "Identifiant invalide." });
      const r = await fetch(API + "/" + id, { headers: auth });
      const d = await r.json();
      if (d.status === "error" || d.status === "rejected") return json(res, 200, { error: "La vidéo n’a pas pu être créée." });
      return json(res, 200, { url: d.status === "done" ? d.result_url : null });
    } catch (e) { return json(res, 500, { error: "Erreur du serveur." }); }
  }

  json(res, 404, { error: "Introuvable." });
}).listen(process.env.PORT || 3000, () => console.log("Prêt."));async function avatars() {
  try {
    const list = require("fs").readdirSync(__dirname + "/avatars")
      .filter((n) => /\.(jpe?g|png)$/i.test(n))
      .map((n) => ({ name: n, url: "https://raw.githubusercontent.com/" + REPO + "/main/avatars/" + encodeURIComponent(n) }));
    if (list.length) return list;
  } catch (e) {}
  return [{ name: "Alice", url: DEFAULT_AVATAR }];
}
