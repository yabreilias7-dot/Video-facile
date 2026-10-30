const http = require("http");

const KEY = process.env.DID_API_KEY;
const DEFAULT_AVATAR = "https://d-id-public-bucket.s3.us-west-2.amazonaws.com/alice.jpg";
const VOICE = process.env.VOICE || "fr-FR-DeniseNeural";
const VOICES = ["fr-FR-DeniseNeural", "fr-FR-HenriNeural"];
const API = "https://api.d-id.com/talks";
const REPO = "yabreilias7-dot/Video-facile";
const FREE_PER_DAY = 12;

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

async function avatars() {
  try {
    const list = require("fs").readdirSync(__dirname + "/avatars")
      .filter((n) => /\.(jpe?g|png)$/i.test(n))
      .map((n) => ({ name: n, url: "https://raw.githubusercontent.com/" + REPO + "/main/avatars/" + encodeURIComponent(n) }));
    if (list.length) return list;
  } catch (e) {}
  return [{ name: "Alice", url: DEFAULT_AVATAR }];
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
textarea{width:100%;min-height:170px;border:2px solid var(--line);border-radius:16px;padding:14px;font:inherit;font-size:1.05rem;background:var(--s);color:var(--ink)}
select{width:100%;margin-top:10px;padding:12px;border:2px solid var(--line);border-radius:12px;font:inherit;background:var(--s);color:var(--ink)}
button,a.dl{display:block;width:100%;margin-top:16px;border:0;border-radius:16px;padding:16px;font:inherit;font-size:1.15rem;font-weight:700;background:var(--acc);color:#1B1540;cursor:pointer;text-align:center;text-decoration:none}
button:disabled{opacity:.6}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.pick{width:auto;margin:0;padding:0;border:4px solid transparent;border-radius:16px;overflow:hidden;background:var(--s)}
.pick img{width:100%;aspect-ratio:1;object-fit:cover;display:block}
.pick[aria-pressed="true"]{border-color:var(--acc)}
video{width:100%;border-radius:16px;margin-top:20px;background:#000}
#msg{min-height:1.5em;margin-top:12px;font-weight:600}
a.dl{font-size:1rem;padding:12px}
</style></head><body><main>
<h1>Votre scène avec avatars.</h1>
<p>Choisissez deux visages, écrivez leur discussion. La scène se crée ici, sans quitter l’application.</p>
<h2>1. Personne 1</h2>
<div class="grid" id="av0"></div>
<select id="v0"><option value="fr-FR-HenriNeural">Voix d’homme</option><option value="fr-FR-DeniseNeural">Voix de femme</option></select>
<h2>2. Personne 2</h2>
<div class="grid" id="av1"></div>
<select id="v1"><option value="fr-FR-DeniseNeural">Voix de femme</option><option value="fr-FR-HenriNeural">Voix d’homme</option></select>
<h2>3. Écrivez la discussion</h2>
<p>Une réplique par ligne, 6 au maximum. La ligne 1 est dite par la personne 1, la ligne 2 par la personne 2, et ainsi de suite.</p>
<textarea id="t" maxlength="900" placeholder="Tu es encore en retard !
Ce n’est pas vrai, j’étais au marché !
Tu dis toujours ça !"></textarea>
<button id="go">Créer ma scène</button>
<div id="msg" role="status"></div>
<div id="out"></div>
</main>
<script>
var go=document.getElementById("go"),msg=document.getElementById("msg"),out=document.getElementById("out"),chosen=["",""];
function bad(m){var e=new Error(m);e.fr=1;return e}
function stop(m){go.disabled=false;msg.textContent=m||""}
function build(idx,list,first){
  var box=document.getElementById("av"+idx);
  list.forEach(function(a,i){
    var b=document.createElement("button");b.className="pick";b.setAttribute("aria-label","Visage "+(i+1));
    var im=document.createElement("img");im.src=a.url;im.alt="";b.appendChild(im);
    b.addEventListener("click",function(){
      chosen[idx]=a.url;
      Array.prototype.forEach.call(box.children,function(c){c.setAttribute("aria-pressed","false")});
      b.setAttribute("aria-pressed","true");
    });
    box.appendChild(b);
    if(i===first){chosen[idx]=a.url;b.setAttribute("aria-pressed","true")}
  });
}
fetch("/api/avatars").then(function(r){return r.json()}).then(function(list){
  build(0,list,0);
  build(1,list,list.length>1?1:0);
}).catch(function(){});
function wait(id,n){
  if(n>60)return Promise.reject(bad("C’est trop long. Réessayez dans un moment."));
  return fetch("/api/status?id="+encodeURIComponent(id)).then(function(r){return r.json()}).then(function(d){
    if(d.error)throw bad(d.error);
    if(d.url)return d.url;
    return new Promise(function(ok){setTimeout(ok,3000)}).then(function(){return wait(id,n+1)});
  });
}
function make(text,avatar,voice){
  return fetch("/api/create",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:text,avatar:avatar,voice:voice})})
    .then(function(r){return r.json()}).then(function(d){
      if(d.error)throw bad(d.error);
      return wait(d.id,0);
    });
}
function show(urls){
  out.innerHTML="";
  var v=document.createElement("video");v.controls=true;v.playsInline=true;v.src=urls[0];
  var i=0;
  v.addEventListener("ended",function(){i++;if(i<urls.length){v.src=urls[i];v.play()}});
  out.appendChild(v);
  urls.forEach(function(u,k){
    var a=document.createElement("a");a.className="dl";a.href=u;a.target="_blank";a.rel="noopener";
    a.textContent="Télécharger la réplique "+(k+1);out.appendChild(a);
  });
}
go.addEventListener("click",function(){
  var lines=document.getElementById("t").value.split("\n").map(function(l){return l.trim()}).filter(function(l){return l.length>=2}).slice(0,6);
  if(lines.length<2){msg.textContent="Écrivez au moins deux répliques, une par ligne.";return}
  var voices=[document.getElementById("v0").value,document.getElementById("v1").value];
  go.disabled=true;out.innerHTML="";
  var urls=[],p=Promise.resolve();
  lines.forEach(function(l,i){
    p=p.then(function(){
      msg.textContent="Création de la réplique "+(i+1)+" sur "+lines.length+"…";
      return make(l,chosen[i%2],voices[i%2]);
    }).then(function(u){urls.push(u)});
  });
  p.then(function(){
    stop("Votre scène est prête. Appuyez sur lecture.");
    show(urls);
  }).catch(function(e){
    stop(e&&e.fr?e.message:"Connexion impossible. Vérifiez votre réseau.");
  });
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
      const { text, avatar, voice } = await body(req);
      if (!text || text.trim().length < 2) return json(res, 400, { error: "Texte trop court." });
      if (!allowed(req.socket.remoteAddress || "x")) return json(res, 429, { error: "Vous avez utilisé vos vidéos du jour." });
      const list = await avatars();
      const pick = list.find((a) => a.url === avatar) || list[0];
      const v = VOICES.includes(voice) ? voice : VOICE;
      const r = await fetch(API, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({
          source_url: pick.url,
          script: { type: "text", input: text.trim().slice(0, 400), provider: { type: "microsoft", voice_id: v } },
        }),
      });
      const d = await r.json();
    if (!r.ok || !d.id) return json(res, 502, { error: "Refus du service : " + (d.kind || "") + " " + (d.description || r.status) });  if (!r.ok || !d.id) return json(res, 502, { error: "Le service d’avatar a refusé la demande." });
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
}).listen(process.env.PORT || 3000, () => console.log("Prêt."));
