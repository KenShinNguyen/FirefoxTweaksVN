// ==UserScript==
// @name         Handlers Helper
// @namespace    https://github.com/KenShinNguyen/FirefoxTweaksVN
// @version      3.9.2
// @description  Gesture helper for protocol_hook.lua / mpv
// @author       KenShinNguyen
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// ==/UserScript==

// Gestures
//   drag a link/image/video and drop it in a direction -> hand its URL to mpv://
//   hold the right button on a link (200ms) -> collect it, drop any link afterwards to send the whole batch
//
// The collected links are only unhighlighted once a batch is sent, so a right-click hold on an
// already collected link removes it again. Firefox opens its context menu on mousedown on
// Windows/Linux, which is too early for the hold to suppress it; set
// ui.context_menus.after_mouseup = true to get the menu out of the way of the gesture.
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

var DEBUG = false;

function log() {
  if (DEBUG) console.log.apply(console, ['Handlers Helper'].concat([].slice.call(arguments)));
}

// ---------------------------------------------------------------- configuration

// The apps protocol_hook.lua understands. pipe/iptv/mpv are aliases the script maps below,
// anything else is passed through as-is (mpva = audio only, ytdla = audio download, mg = gallery-dl).
const guide = 'Value: pipe ytdl stream mpv iptv mpva ytdla mg (empty: disabled)';
const live_window_width = 400;
const live_window_height = 640;
const DEAD_ZONE = 50; // px; a drop that lands this close to the start has no direction
const HOLD_DELAY = 200; // ms the right button has to stay down before a link is collected
const HIGHLIGHT = [['outline', '4px solid yellow'], ['outline-offset', '-4px']];
const isTopFrame = window.self === window.top;

// Entries are hostnames: 'animevui.com' covers 'cdn.animevui.com', a blank one covers nothing.
function parseDomains(value) {
  return String(value == null ? '' : value).split(',').map(function(d) {
    return d.trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/[/?#].*$/, '').replace(/^\*\./, '').replace(/\.$/, '');
  }).filter(function(d) {
    return d !== '';
  });
}

var UP = GM_getValue('UP', 'pipe');
var DOWN = GM_getValue('DOWN', 'ytdl');
var LEFT = GM_getValue('LEFT', 'stream');
var RIGHT = GM_getValue('RIGHT', 'mpv');
var UP_LEFT = GM_getValue('UP_LEFT', 'list');
var UP_RIGHT = GM_getValue('UP_RIGHT', '');
var DOWN_LEFT = GM_getValue('DOWN_LEFT', '');
var DOWN_RIGHT = GM_getValue('DOWN_RIGHT', '');
var hlsdomain = GM_getValue('hlsdomain', 'cdn.animevui.com');
var livechat = GM_getValue('livechat', false);
var total_direction = Number(GM_getValue('total_direction', 4)) === 8 ? 8 : 4;
var hlsdomains = parseDomains(hlsdomain);

function registerPrompt(label, key, current, hint) {
  GM_registerMenuCommand(label + (current || 'off'), function() {
    // An empty answer turns the direction off, only a cancelled prompt keeps the old value.
    var p = window.prompt(hint || guide, current);
    if (p === null) {
      return;
    }
    GM_setValue(key, p.trim());
    window.location.reload();
  });
}

function registerToggle(label, key, current, on, off) {
  GM_registerMenuCommand(label + current, function() {
    GM_setValue(key, current === on ? off : on);
    window.location.reload();
  });
}

// Every frame of a page would otherwise register its own copy of the whole menu.
if (isTopFrame) {
  registerPrompt('↑: ', 'UP', UP);
  registerPrompt('↓: ', 'DOWN', DOWN);
  registerPrompt('←: ', 'LEFT', LEFT);
  registerPrompt('→: ', 'RIGHT', RIGHT);
  if (total_direction === 8) {
    registerPrompt('↖: ', 'UP_LEFT', UP_LEFT);
    registerPrompt('↗: ', 'UP_RIGHT', UP_RIGHT);
    registerPrompt('↙: ', 'DOWN_LEFT', DOWN_LEFT);
    registerPrompt('↘: ', 'DOWN_RIGHT', DOWN_RIGHT);
  }
  registerPrompt('HLS Force: ', 'hlsdomain', hlsdomains.join(','), 'Hostnames, example: 1.com,2.com,3.com');
  registerToggle('Live Chat: ', 'livechat', livechat === true, true, false);
  registerToggle('Total Direction: ', 'total_direction', total_direction, 8, 4);
}

log(UP, DOWN, LEFT, RIGHT, hlsdomains, livechat, total_direction);

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

  var hls = isHlsHost(location.hostname) || urls.some(isHlsUrl);
  if (hls && type === 'stream') {
    urls = urls.map(function(link) {
      return link.replace(/^https?:/i, 'hls:');
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

  // protocol_hook.lua splits the payload on whitespace and reads the query after the last slash.
  var query = ['referer=' + GM_btoaUrl(location.href)];
  if (hls === true) {
    query.push('hls=1');
  }
  var url2 = 'mpv://' + app + '/' + GM_btoaUrl(urls.join(' ')) + '/?' + query.join('&');

  if (app === 'stream' && livechat === true) {
    livechatopener(url || location.href);
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
  if (total_direction === 4) {
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
      return RIGHT;
    case DIRECTIONS.LEFT:
      return LEFT;
    case DIRECTIONS.UP:
      return UP;
    case DIRECTIONS.DOWN:
      return DOWN;
    case DIRECTIONS.UP_LEFT:
      return UP_LEFT;
    case DIRECTIONS.UP_RIGHT:
      return UP_RIGHT;
    case DIRECTIONS.DOWN_LEFT:
      return DOWN_LEFT;
    case DIRECTIONS.DOWN_RIGHT:
      return DOWN_RIGHT;
    default:
      return '';
  }
}

var dragOrigin = null;

// Capture on the document: it beats pages that stop drag events on their way up, and it sees
// through shadow roots, so the listener does not have to be duplicated into every shadow root.
document.addEventListener('dragstart', function(e) {
  dragOrigin = { x: e.clientX, y: e.clientY };
  log('dragstart', dragOrigin);
}, true);

document.addEventListener('dragend', function(e) {
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
var suppressContextMenu = false;

function cancelHold() {
  if (holdTimer !== null) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }
  holdTarget = null;
}

document.addEventListener('mousedown', function(e) {
  // Cleared on every press, otherwise a hold would swallow the menu of the next right click.
  suppressContextMenu = false;
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
  holdTarget = { href: href, element: (target && target.nodeType === 1) ? target : link };
  holdTimer = setTimeout(function() {
    holdTimer = null;
    if (!holdTarget) {
      return;
    }
    toggleCollected(holdTarget.href, holdTarget.element);
    holdTarget = null;
    suppressContextMenu = true;
  }, HOLD_DELAY);
}, true);

document.addEventListener('mouseup', function(e) {
  if (e.button === 2) {
    cancelHold();
  }
}, true);

document.addEventListener('contextmenu', function(e) {
  if (suppressContextMenu) {
    suppressContextMenu = false;
    e.preventDefault();
  }
}, true);

// ---------------------------------------------------------------- youtube utilities

if (isTopFrame && (location.hostname === 'www.youtube.com' || location.hostname === 'm.youtube.com')) {
  let isMobile = location.hostname === 'm.youtube.com';
  function addMenuCommand(s, url, b) {
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
    addMenuCommand('Switch to YouTube Mobile persistently', 'https://m.youtube.com/?persist_app=1&app=m', true);
    addMenuCommand('Switch to YouTube Mobile temporarily', 'https://m.youtube.com/?persist_app=0&app=m', false);
  } else {
    addMenuCommand('Switch to YouTube Desktop persistently', 'https://www.youtube.com/?persist_app=1&app=desktop', true);
    addMenuCommand('Switch to YouTube Desktop temporarily', 'https://www.youtube.com/?persist_app=0&app=desktop', false);
    GM_addStyle('ytm-rich-item-renderer {width: 33%!important;margin: 1px!important;padding: 0px!important;}');
  }
}
