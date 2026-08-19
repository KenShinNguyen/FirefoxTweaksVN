// ==UserScript==
// @name         Handlers Helper
// @namespace    https://github.com/KenShinNguyen/FirefoxTweaksVN
// @version      3.10.0
// @description  Gesture helper for protocol_hook.lua / mpv
// @author       KenShinNguyen
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_addValueChangeListener
// ==/UserScript==

// Gestures
//   drag a link/image/video and drop it in a direction -> hand its URL to mpv://
//   hold the right button on a link (200ms) -> collect it, drop any link afterwards to send the whole batch
//   Esc -> drop the collected batch without sending it
//
// A label follows the cursor while dragging and names the app the drop would reach. No label means
// the drop would do nothing, so a gesture can be called off by coming back to where it started
// instead of by guessing. "Gesture Hint" turns it off.
//
// The collected links are only unhighlighted once a batch is sent, so a right-click hold on an
// already collected link removes it again. A press that starts moving is not a hold, which leaves
// right-drag gestures alone. Firefox opens its context menu on mousedown on Windows/Linux, which is
// too early for the hold to suppress it; set ui.context_menus.after_mouseup = true to get the menu
// out of the way of the gesture.
//
// What a drop hands over, decided in this order:
//   an <a> on mpv://                   handed over as it stands, collected links stay collected
//   links collected with the hold      the batch, and the dragged link is not added to it
//   an <a> with an http(s) href        the link
//   an <img>/<video>/<audio>           its currentSrc, so a srcset candidate and the source a
//                                      player is really on both beat the src attribute
//   an <img> inside an <a>             the image, not the link it sits in
//   a link or media on a URL mpv       the page it sits on, which is what makes dragging a
//     cannot use (blob:, javascript:)  player on a blob: source open the watch page
//   plain content with no URL at all   nothing: a stray text drag must not send the page

//'iptv'

var config = {};

function log() {
  if (config.debug) console.log.apply(console, ['Handlers Helper'].concat([].slice.call(arguments)));
}

// ---------------------------------------------------------------- configuration

// The apps protocol_hook.lua understands. pipe/iptv/mpv are aliases the script maps below,
// anything else is passed through as-is (mpva = audio only, ytdla = audio download, mg = gallery-dl).
const guide = 'Value: pipe ytdl stream mpv iptv mpva ytdla mg (empty: disabled)';
const live_window_width = 400;
const live_window_height = 640;
const DEAD_ZONE = 50; // px; a drop that lands this close to the start has no direction
const HOLD_DELAY = 200; // ms the right button has to stay down before a link is collected
const HOLD_SLOP = 12; // px the pointer may drift in that time before the press stops being a hold
const MENU_GUARD = 1000; // ms a finished hold stays entitled to swallow the context menu it caused
const HIGHLIGHT = [['outline', '4px solid yellow'], ['outline-offset', '-4px']];
const isTopFrame = window.self === window.top;

// Every setting is read through here, so a change written once can be picked up in place by every
// frame instead of by reloading the page out from under whatever is playing on it.
const DEFAULTS = Object.freeze({
  UP: 'pipe',
  DOWN: 'ytdl',
  LEFT: 'stream',
  RIGHT: 'mpv',
  UP_LEFT: 'list',
  UP_RIGHT: '',
  DOWN_LEFT: '',
  DOWN_RIGHT: '',
  hlsdomain: 'cdn.animevui.com',
  livechat: false,
  total_direction: 4,
  hint: true,
  debug: false
});
const FLAGS = ['livechat', 'hint', 'debug'];

var hlsdomains = [];

// Entries are hostnames: 'animevui.com' covers 'cdn.animevui.com', a blank one covers nothing.
// A whole URL is taken as well, so one pasted out of the address bar works: the scheme, any
// credentials, the port and everything from the first slash on come back off again, because
// location.hostname carries none of them and an entry that kept them could never match.
function parseDomains(value) {
  return String(value == null ? '' : value).split(',').map(function(d) {
    return d.trim().toLowerCase()
      .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
      .replace(/^[^/?#@]*@/, '')
      .replace(/[/?#].*$/, '')
      .replace(/:\d*$/, '')
      .replace(/^\*\./, '')
      .replace(/\.$/, '');
  }).filter(function(d) {
    return d !== '';
  });
}

function loadSetting(key) {
  var raw = GM_getValue(key, DEFAULTS[key]);
  if (key === 'total_direction') {
    config[key] = Number(raw) === 8 ? 8 : 4;
  } else if (FLAGS.indexOf(key) !== -1) {
    config[key] = raw === true || raw === 'true';
  } else {
    config[key] = String(raw == null ? '' : raw).trim();
  }
  if (key === 'hlsdomain') {
    hlsdomains = parseDomains(config[key]);
  }
}

Object.keys(DEFAULTS).forEach(function(key) {
  loadSetting(key);
});

log('config', config, hlsdomains);

// ---------------------------------------------------------------- url utilities

// SVG anchors carry an SVGAnimatedString instead of a resolved string.
function hrefOf(el) {
  if (!el) {
    return '';
  }
  var href = el.href;
  if (typeof href === 'string') {
    return href;
  }
  if (href && typeof href.baseVal === 'string') {
    try {
      return new URL(href.baseVal, document.baseURI).href;
    } catch (err) {
      return '';
    }
  }
  return '';
}

// composedPath() keeps the real target of events that crossed a shadow root, where e.target is
// retargeted to the host element.
function eventPath(e) {
  if (typeof e.composedPath === 'function') {
    var path = e.composedPath();
    if (path && path.length) {
      return path;
    }
  }
  var fallback = [];
  var node = e.target;
  while (node) {
    fallback.push(node);
    node = node.parentNode || node.host;
  }
  return fallback;
}

function findAnchor(e) {
  var path = eventPath(e);
  for (var i = 0; i < path.length; i++) {
    var node = path[i];
    if (node === document || node === window) {
      break;
    }
    if (node && node.nodeType === 1 && String(node.tagName).toLowerCase() === 'a') {
      return node;
    }
  }
  return null;
}

// What the drag came off, so a drop can tell "this link has no usable URL" (still worth sending
// the page it sits on) from "this was not a link at all" (nothing to send).
function dragSource(e) {
  var target = eventPath(e)[0];
  var href = hrefOf(target);
  if (href) {
    return { url: href, kind: 'link' };
  }
  // A <video> hands over what it is actually playing, not the src attribute it was built with.
  if (target && typeof target.currentSrc === 'string' && target.currentSrc) {
    return { url: target.currentSrc, kind: 'media' };
  }
  if (target && typeof target.src === 'string' && target.src) {
    return { url: target.src, kind: 'media' };
  }
  href = hrefOf(findAnchor(e));
  if (href) {
    return { url: href, kind: 'link' };
  }
  return { url: '', kind: '' };
}

// btoa() only speaks latin1, so non-ASCII URLs have to be encoded byte by byte first.
// The alphabet and the stripped padding match atobUrl() in protocol_hook.lua.
function GM_btoaUrl(url) {
  var bytes = new TextEncoder().encode(String(url == null ? '' : url));
  var binary = '';
  for (var i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\//g, '_').replace(/\+/g, '-').replace(/=/g, '');
}

// 'animevui.com' covers the site and its subdomains, and nothing else: a substring test would
// also swallow evil-animevui.com.attacker.tld and any URL that merely mentions the host.
function hostnameMatches(hostname, domain) {
  hostname = String(hostname == null ? '' : hostname).toLowerCase().replace(/\.$/, '');
  return hostname === domain || hostname.endsWith('.' + domain);
}

// The page itself being on a configured host is what "HLS Force" forces: every link on it counts.
function isHlsHost(hostname) {
  return hlsdomains.some(function(domain) {
    return hostnameMatches(hostname, domain);
  });
}

function isHlsUrl(url) {
  var parsed;
  try {
    parsed = new URL(url, location.href);
  } catch (err) {
    return false;
  }
  return isHlsHost(parsed.hostname);
}

// mpv:// from a subframe is unreliable, so the top frame takes the handover and stays where it is.
// A parent that cannot be reached at all throws on the way in, and the frame handles its own.
function navigate(url) {
  log('navigate', url);
  try {
    if (window.top !== window.self) {
      window.top.location.href = url;
      return;
    }
  } catch (err) {
    log('top frame navigation failed', err);
  }
  location.href = url;
}

// ---------------------------------------------------------------- collection engine

var collected_urls = new Map();

// An outline instead of a border: it marks the link without reflowing the page around it.
// The declarations it overwrites are kept so the mark can be taken back off exactly.
function highlight(el) {
  var saved = { el: el, props: [] };
  if (!el || !el.style) {
    return saved;
  }
  HIGHLIGHT.forEach(function(prop) {
    saved.props.push([prop[0], el.style.getPropertyValue(prop[0]), el.style.getPropertyPriority(prop[0])]);
    el.style.setProperty(prop[0], prop[1], 'important');
  });
  return saved;
}

function unhighlight(saved) {
  if (!saved || !saved.el || !saved.el.style) {
    return;
  }
  saved.props.forEach(function(prop) {
    if (prop[1]) {
      saved.el.style.setProperty(prop[0], prop[1], prop[2]);
    } else {
      saved.el.style.removeProperty(prop[0]);
    }
  });
}

function toggleCollected(href, el) {
  if (collected_urls.has(href)) {
    unhighlight(collected_urls.get(href));
    collected_urls.delete(href);
  } else {
    collected_urls.set(href, highlight(el));
  }
  log('collected', Array.from(collected_urls.keys()));
  refreshMenu();
}

function collectedUrls() {
  return Array.from(collected_urls.keys());
}

// Reading the batch and dropping it are separate steps: EA() only drops it once the handover
// actually happened, so anything that throws on the way out leaves the links collected and marked.
function clearCollected() {
  collected_urls.forEach(function(saved) {
    unhighlight(saved);
  });
  collected_urls.clear();
  refreshMenu();
}

// ---------------------------------------------------------------- live chat

function popout(chaturl) {
  window.open(chaturl, '', 'fullscreen=no,toolbar=no,titlebar=no,menubar=no,location=no,width=' + live_window_width + ',height=' + live_window_height);
}

function youtubeVideoId(nurl) {
  var v = nurl.searchParams.get('v');
  if (v) {
    return v;
  }
  if (nurl.hostname === 'youtu.be') {
    return nurl.pathname.split('/').filter(Boolean)[0] || '';
  }
  var m = nurl.pathname.match(/^\/(?:live|shorts|embed)\/([^/?#]+)/);
  return m ? m[1] : '';
}

function livechatopener(url) {
  var nurl;
  try {
    nurl = new URL(url, location.href);
  } catch (err) {
    return;
  }
  var host = nurl.hostname;
  if (hostnameMatches(host, 'youtube.com') || host === 'youtu.be') {
    var id = youtubeVideoId(nurl);
    if (id) {
      popout('https://www.youtube.com/live_chat?is_popout=1&v=' + encodeURIComponent(id));
    }
  } else if (hostnameMatches(host, 'twitch.tv')) {
    var channel = nurl.pathname.split('/').filter(Boolean)[0];
    if (channel) {
      popout('https://www.twitch.tv/popout/' + channel + '/chat?popout=');
    }
  } else if (hostnameMatches(host, 'nimo.tv')) {
    var player = null;
    try {
      player = document.querySelector('a[href=' + JSON.stringify(nurl.pathname) + '] .nimo-player.n-as-full');
    } catch (err) {
      log('nimo lookup failed', err);
    }
    if (player && player.id) {
      popout('https://www.nimo.tv/popout/chat/' + player.id.replace('home-hot-', ''));
    }
  }
}

// ---------------------------------------------------------------- protocol engine

// protocol_hook.lua splits the payload on whitespace, so a URL carrying a literal space would
// arrive as two broken ones. The browser hands these over encoded already; a src attribute
// written by hand is the exception this covers.
function packUrls(urls) {
  return urls.map(function(link) {
    return link.replace(/[ \t\n\r\f\v]/g, encodeURIComponent);
  }).join(' ');
}

function EA(source, type) {
  if (!type) {
    log('no app bound to this direction');
    return;
  }
  var attr = String(source && source.url != null ? source.url : '').trim();
  var kind = (source && source.kind) || '';
  log(attr, kind, type);

  if (attr.startsWith('mpv://')) {
    navigate(attr);
    return;
  }

  // A link or a media element whose URL mpv cannot use (blob:, javascript:) still means "the page
  // this sits on". A drag that started on plain content means nothing, and must not send the page.
  var url = /^https?:/i.test(attr) ? attr : '';
  if (!url && kind) {
    url = location.href;
  }

  // A batch beats the dropped link, that is the whole point of collecting them.
  var urls = collectedUrls();
  if (urls.length === 0) {
    if (!url) {
      log('nothing to send');
      return;
    }
    urls = [url];
  }

  // The chat window belongs to what is about to play, which is the head of the batch when there is
  // one: the dragged link only triggered the handover and is not itself sent.
  var chatTarget = urls[0] || location.href;

  // A page on a configured host forces everything it hands over, that is what "HLS Force" means.
  // Past that each link answers for itself, so one HLS sibling in a batch cannot drag the rest along.
  var forced = isHlsHost(location.hostname);
  var hls = forced || urls.some(isHlsUrl);
  // Only streamlink ever sees this scheme, and it reads hls:// as "use the HLS plugin". The yt-dlp
  // and iptv paths would choke on it, so nothing but 'stream' is rewritten.
  if (type === 'stream') {
    urls = urls.map(function(link) {
      return (forced || isHlsUrl(link)) ? link.replace(/^https?:/i, 'hls:') : link;
    });
  }

  var app = type;
  if (type === 'pipe') {
    app = 'mpvy';
  } else if (type === 'iptv') {
    app = 'list';
  } else if (type === 'mpv' || type === 'vid') {
    app = 'play';
  }

  // protocol_hook.lua reads the query after the last slash.
  var query = ['referer=' + GM_btoaUrl(location.href)];
  if (hls === true) {
    query.push('hls=1');
  }
  var url2 = 'mpv://' + app + '/' + GM_btoaUrl(packUrls(urls)) + '/?' + query.join('&');

  if (app === 'stream' && config.livechat === true) {
    livechatopener(chatTarget);
  }
  navigate(url2);
  clearCollected();
}

// ---------------------------------------------------------------- gesture engine

/*=================
|                 |
| 1↖   2↑   3↗ |
|                 |
| 4←    5    6→ |
|                 |
| 7↙   8↓   9↘ |
|                 |
|=================*/
const DIRECTIONS = Object.freeze({
  UP_LEFT: 1,
  UP: 2,
  UP_RIGHT: 3,
  LEFT: 4,
  NONE: 5,
  RIGHT: 6,
  DOWN_LEFT: 7,
  DOWN: 8,
  DOWN_RIGHT: 9
});

function getDirection(x, y, cx, cy) {
  var dx = cx - x;
  var dy = cy - y;
  // A drop outside the window reports 0,0 instead of a position.
  if (cx === 0 && cy === 0) {
    return DIRECTIONS.NONE;
  }
  if (Math.max(Math.abs(dx), Math.abs(dy)) <= DEAD_ZONE) {
    return DIRECTIONS.NONE;
  }
  if (config.total_direction === 4) {
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx > 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
    }
    return dy > 0 ? DIRECTIONS.DOWN : DIRECTIONS.UP;
  }
  // Eight 45° sectors, y pointing down: 0° is a drop to the right, +90° straight down.
  var angle = Math.atan2(dy, dx) * 180 / Math.PI;
  if (angle >= -22.5 && angle < 22.5) {
    return DIRECTIONS.RIGHT;
  }
  if (angle >= 22.5 && angle < 67.5) {
    return DIRECTIONS.DOWN_RIGHT;
  }
  if (angle >= 67.5 && angle < 112.5) {
    return DIRECTIONS.DOWN;
  }
  if (angle >= 112.5 && angle < 157.5) {
    return DIRECTIONS.DOWN_LEFT;
  }
  if (angle >= 157.5 || angle < -157.5) {
    return DIRECTIONS.LEFT;
  }
  if (angle >= -157.5 && angle < -112.5) {
    return DIRECTIONS.UP_LEFT;
  }
  if (angle >= -112.5 && angle < -67.5) {
    return DIRECTIONS.UP;
  }
  return DIRECTIONS.UP_RIGHT;
}

function appForDirection(direction) {
  switch (direction) {
    case DIRECTIONS.RIGHT:
      return config.RIGHT;
    case DIRECTIONS.LEFT:
      return config.LEFT;
    case DIRECTIONS.UP:
      return config.UP;
    case DIRECTIONS.DOWN:
      return config.DOWN;
    case DIRECTIONS.UP_LEFT:
      return config.UP_LEFT;
    case DIRECTIONS.UP_RIGHT:
      return config.UP_RIGHT;
    case DIRECTIONS.DOWN_LEFT:
      return config.DOWN_LEFT;
    case DIRECTIONS.DOWN_RIGHT:
      return config.DOWN_RIGHT;
    default:
      return '';
  }
}

// A drag gives no feedback of its own, so without this the direction is only readable once the
// drop has already happened. Every declaration is !important and the label takes no pointer
// events, so no page can style it away or lose the drop to it.
const HINT_STYLE = [
  ['position', 'fixed'], ['left', '0'], ['top', '0'], ['margin', '0'], ['border', '0'],
  ['z-index', '2147483647'], ['pointer-events', 'none'], ['padding', '3px 8px'],
  ['border-radius', '4px'], ['background', 'rgba(20,20,20,0.88)'], ['color', '#fff'],
  ['font', '700 13px/1.4 system-ui, sans-serif'], ['white-space', 'pre'],
  ['box-shadow', '0 2px 6px rgba(0,0,0,0.45)']
];

var hintEl = null;
var hintSize = { w: 0, h: 0 };

function showHint(text, x, y) {
  if (!hintEl) {
    var host = document.body || document.documentElement;
    if (!host) {
      return;
    }
    hintEl = document.createElement('div');
    HINT_STYLE.forEach(function(prop) {
      hintEl.style.setProperty(prop[0], prop[1], 'important');
    });
    host.appendChild(hintEl);
  }
  // Measuring costs a reflow, so it is only done when the label actually says something new.
  if (hintEl.textContent !== text) {
    hintEl.textContent = text;
    hintSize = { w: hintEl.offsetWidth, h: hintEl.offsetHeight };
  }
  // Below and right of the cursor, pulled back inside the window rather than off the edge of it.
  var left = Math.max(4, Math.min(x + 16, window.innerWidth - hintSize.w - 4));
  var top = Math.max(4, Math.min(y + 20, window.innerHeight - hintSize.h - 4));
  hintEl.style.setProperty('transform', 'translate(' + Math.round(left) + 'px,' + Math.round(top) + 'px)', 'important');
}

function hideHint() {
  if (hintEl && hintEl.parentNode) {
    hintEl.parentNode.removeChild(hintEl);
  }
  hintEl = null;
  hintSize = { w: 0, h: 0 };
}

// Nothing to show is shown as nothing: inside the dead zone, on a direction with no app bound and
// on a drag with no URL behind it, the missing label is the answer.
function updateHint(x, y) {
  if (!config.hint || !dragOrigin) {
    return;
  }
  var app = dragOrigin.sendable ? appForDirection(getDirection(dragOrigin.x, dragOrigin.y, x, y)) : '';
  if (!app) {
    hideHint();
    return;
  }
  showHint(app, x, y);
}

var dragOrigin = null;

// Capture on the document: it beats pages that stop drag events on their way up, and it sees
// through shadow roots, so the listener does not have to be duplicated into every shadow root.
document.addEventListener('dragstart', function(e) {
  dragOrigin = {
    x: e.clientX,
    y: e.clientY,
    sendable: !!dragSource(e).kind || collected_urls.size > 0
  };
  log('dragstart', dragOrigin);
}, true);

// 'drag' fires on the element the gesture started from and 'dragover' on whatever the cursor is
// over: together they keep the label up to date without the script ever accepting the drop, which
// it must not do or the page below would stop seeing its own drags.
function onDragMove(e) {
  updateHint(e.clientX, e.clientY);
}

document.addEventListener('drag', onDragMove, true);
document.addEventListener('dragover', onDragMove, true);
document.addEventListener('drop', hideHint, true);

document.addEventListener('dragend', function(e) {
  hideHint();
  var origin = dragOrigin;
  dragOrigin = null;
  if (!origin) {
    return;
  }
  var direction = getDirection(origin.x, origin.y, e.clientX, e.clientY);
  var app = appForDirection(direction);
  log(origin.x, origin.y, e.clientX, e.clientY, 'Direction: ' + direction, app);
  if (!app) {
    return;
  }
  EA(dragSource(e), app);
}, true);

var holdTimer = null;
var holdTarget = null;
var holdOrigin = null;
var suppressMenuUntil = 0;

// A press that starts travelling was aiming somewhere else, and collecting a link out from under a
// right-drag gesture is the kind of surprise that costs the user a click to undo.
function onHoldMove(e) {
  if (!holdOrigin) {
    return;
  }
  if (Math.abs(e.clientX - holdOrigin.x) > HOLD_SLOP || Math.abs(e.clientY - holdOrigin.y) > HOLD_SLOP) {
    log('hold given up, the pointer moved');
    cancelHold();
  }
}

function cancelHold() {
  if (holdTimer !== null) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }
  holdTarget = null;
  holdOrigin = null;
  document.removeEventListener('mousemove', onHoldMove, true);
}

document.addEventListener('mousedown', function(e) {
  // Cleared on every press, otherwise a hold would swallow the menu of the next right click.
  suppressMenuUntil = 0;
  cancelHold();
  if (e.button !== 2) {
    return;
  }
  var link = findAnchor(e);
  var href = hrefOf(link);
  if (!href) {
    return;
  }
  var target = eventPath(e)[0];
  holdOrigin = { x: e.clientX, y: e.clientY };
  holdTarget = { href: href, element: (target && target.nodeType === 1) ? target : link };
  document.addEventListener('mousemove', onHoldMove, true);
  holdTimer = setTimeout(function() {
    holdTimer = null;
    if (!holdTarget) {
      return;
    }
    toggleCollected(holdTarget.href, holdTarget.element);
    cancelHold();
    // The press has been spent on the hold, so the menu it is about to open is owed to nobody.
    // Only that one menu: a menu opened any other way, or long afterwards, is left alone.
    suppressMenuUntil = Date.now() + MENU_GUARD;
  }, HOLD_DELAY);
}, true);

document.addEventListener('mouseup', function(e) {
  if (e.button === 2) {
    cancelHold();
  }
}, true);

document.addEventListener('contextmenu', function(e) {
  if (suppressMenuUntil && Date.now() <= suppressMenuUntil) {
    suppressMenuUntil = 0;
    e.preventDefault();
  }
}, true);

// A batch that is not going anywhere still has to be droppable, and the links it holds can have
// scrolled away or been replaced by then, which leaves no highlight left to click a second time.
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && collected_urls.size > 0) {
    log('batch dropped on Escape');
    clearCollected();
  }
}, true);

// ---------------------------------------------------------------- menu

const ARROWS = Object.freeze({
  UP: '↑',
  DOWN: '↓',
  LEFT: '←',
  RIGHT: '→',
  UP_LEFT: '↖',
  UP_RIGHT: '↗',
  DOWN_LEFT: '↙',
  DOWN_RIGHT: '↘'
});
const DIAGONALS = ['UP_LEFT', 'UP_RIGHT', 'DOWN_LEFT', 'DOWN_RIGHT'];

// Applying a change used to mean reloading the page, which costs whatever was playing on it.
// Relabelling the menu in place needs GM_unregisterMenuCommand, and the copy of the settings each
// frame holds needs GM_addValueChangeListener to hear about the change at all. A manager that is
// missing either one keeps the reload, so nothing silently goes half-applied.
const canRelabelMenu = typeof GM_unregisterMenuCommand === 'function';
const canWatchValues = typeof GM_addValueChangeListener === 'function';
const liveSettings = canRelabelMenu && canWatchValues;

var menuIds = [];

function addMenuCommand(label, handler) {
  var id = GM_registerMenuCommand(label, handler);
  if (id !== undefined && id !== null) {
    menuIds.push(id);
  }
}

function writeSetting(key, value) {
  GM_setValue(key, value);
  if (!liveSettings) {
    window.location.reload();
    return;
  }
  // The change listener will say the same thing, but it is not waited on: the menu answers now.
  applySetting(key);
}

function applySetting(key) {
  var before = JSON.stringify(config[key]);
  loadSetting(key);
  if (JSON.stringify(config[key]) === before) {
    return;
  }
  log('setting', key, config[key]);
  refreshMenu();
}

function registerPrompt(label, key, current, hint) {
  addMenuCommand(label + (current || 'off'), function() {
    // An empty answer turns the direction off, only a cancelled prompt keeps the old value.
    var p = window.prompt(hint || guide, current);
    if (p === null || p.trim() === current) {
      return;
    }
    writeSetting(key, p.trim());
  });
}

function registerToggle(label, key, current, on, off) {
  addMenuCommand(label + current, function() {
    writeSetting(key, current === on ? off : on);
  });
}

function buildMenu() {
  Object.keys(ARROWS).forEach(function(key) {
    if (config.total_direction === 4 && DIAGONALS.indexOf(key) !== -1) {
      return;
    }
    registerPrompt(ARROWS[key] + ': ', key, config[key]);
  });
  registerPrompt('HLS Force: ', 'hlsdomain', hlsdomains.join(','), 'Hostnames, example: 1.com,2.com,3.com');
  registerToggle('Live Chat: ', 'livechat', config.livechat, true, false);
  registerToggle('Total Direction: ', 'total_direction', config.total_direction, 8, 4);
  registerToggle('Gesture Hint: ', 'hint', config.hint, true, false);
  registerToggle('Debug Log: ', 'debug', config.debug, true, false);
  // Without relabelling there is no honest count to show, so the entry only offers the clearing.
  addMenuCommand(canRelabelMenu ? 'Collected: ' + collected_urls.size + ' (clear)' : 'Clear collected links', clearCollected);
}

function refreshMenu() {
  if (!isTopFrame || !canRelabelMenu) {
    return;
  }
  menuIds.splice(0).forEach(function(id) {
    try {
      GM_unregisterMenuCommand(id);
    } catch (err) {
      log('menu cleanup failed', err);
    }
  });
  buildMenu();
}

// Every frame of a page would otherwise register its own copy of the whole menu.
if (isTopFrame) {
  buildMenu();
}

// Only the top frame owns the menu, but a video usually sits in a subframe and reads its own copy
// of the settings, so every frame has to hear a change to act on it.
if (canWatchValues) {
  Object.keys(DEFAULTS).forEach(function(key) {
    GM_addValueChangeListener(key, function() {
      applySetting(key);
    });
  });
}

// ---------------------------------------------------------------- youtube utilities

if (isTopFrame && (location.hostname === 'www.youtube.com' || location.hostname === 'm.youtube.com')) {
  let isMobile = location.hostname === 'm.youtube.com';
  // Registered outside menuIds: these do not change with the settings, and refreshMenu() rebuilds
  // only what buildMenu() puts there.
  function addSwitchCommand(s, url, b) {
    GM_registerMenuCommand(s, function() {
      if (b == true) {
        if (url.indexOf('m.youtube.com') != -1) {
          GM_setValue('hh_mobile', true);
        } else if (url.indexOf('www.youtube.com') != -1) {
          GM_setValue('hh_mobile', false);
        }
      } else {
        GM_deleteValue('hh_mobile');
      }
      location.replace(url);
    });
  }
  if (!isMobile) {
    addSwitchCommand('Switch to YouTube Mobile persistently', 'https://m.youtube.com/?persist_app=1&app=m', true);
    addSwitchCommand('Switch to YouTube Mobile temporarily', 'https://m.youtube.com/?persist_app=0&app=m', false);
  } else {
    addSwitchCommand('Switch to YouTube Desktop persistently', 'https://www.youtube.com/?persist_app=1&app=desktop', true);
    addSwitchCommand('Switch to YouTube Desktop temporarily', 'https://www.youtube.com/?persist_app=0&app=desktop', false);
    GM_addStyle('ytm-rich-item-renderer {width: 33%!important;margin: 1px!important;padding: 0px!important;}');
  }
}
