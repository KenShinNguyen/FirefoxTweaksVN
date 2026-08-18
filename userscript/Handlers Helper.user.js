// ==UserScript==
// @name        Handlers Helper
// @include       *://*/*
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_deleteValue
// @grant       GM_addStyle
// @grant       GM_registerMenuCommand
// @version     3.8
// @author      -
// @description Helper for protocol_hook.lua
// @namespace Violentmonkey Scripts
// ==/UserScript==

// Gestures
//   drag a link/image/video and drop it in a direction -> hand its URL to mpv://
//   hold the right button on a link (200ms) -> collect it, drop any link afterwards to send the whole batch
//
// The collected links are only unhighlighted once a batch is sent, so a right-click hold on an
// already collected link removes it again. Firefox opens its context menu on mousedown on
// Windows/Linux, which is too early for the hold to suppress it; set
// ui.context_menus.after_mouseup = true to get the menu out of the way of the gesture.

//'iptv'

var DEBUG = false;

// The apps protocol_hook.lua understands. pipe/iptv/mpv are aliases the script maps below,
// anything else is passed through as-is (mpva = audio only, ytdla = audio download, mg = gallery-dl).
const guide = 'Value: pipe ytdl stream mpv iptv mpva ytdla mg (empty: disabled)';
const live_window_width = 400;
const live_window_height = 640;
const DEAD_ZONE = 50; // px; a drop that lands this close to the start has no direction
const HOLD_DELAY = 200; // ms the right button has to stay down before a link is collected
const HIGHLIGHT = [['outline', '4px solid yellow'], ['outline-offset', '-4px']];
const isTopFrame = window.self === window.top;

function log() {
  if (DEBUG) console.log.apply(console, ['Handlers Helper'].concat([].slice.call(arguments)));
}

// An empty entry would match every URL through indexOf(), so blanks are dropped here.
function parseDomains(value) {
  return String(value == null ? '' : value).split(',').map(function(d) {
    return d.trim();
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
  registerPrompt('HLS Force: ', 'hlsdomain', hlsdomains.join(','), 'Example: 1.com,2.com,3.com,4.com');
  registerToggle('Live Chat: ', 'livechat', livechat === true, true, false);
  registerToggle('Total Direction: ', 'total_direction', total_direction, 8, 4);
}

log(UP, DOWN, LEFT, RIGHT, hlsdomains, livechat, total_direction);

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

// Hands out the collected links and clears the batch, so a failed send never leaves them stuck.
function takeCollected() {
  var urls = [];
  collected_urls.forEach(function(saved, href) {
    unhighlight(saved);
    urls.push(href);
  });
  collected_urls.clear();
  return urls;
}

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

// The dropped element wins (an image or a video plays on its own), the link around it is the fallback.
function dragUrl(e) {
  var target = eventPath(e)[0];
  var direct = hrefOf(target);
  if (!direct && target && typeof target.currentSrc === 'string' && target.currentSrc) {
    direct = target.currentSrc;
  }
  if (!direct && target && typeof target.src === 'string') {
    direct = target.src;
  }
  if (direct) {
    return direct;
  }
  return hrefOf(findAnchor(e));
}

// btoa() only speaks latin1, so non-ASCII URLs have to be encoded byte by byte first.
function GM_btoaUrl(url) {
  var binary = '';
  var text = String(url == null ? '' : url);
  if (typeof TextEncoder !== 'undefined') {
    var bytes = new TextEncoder().encode(text);
    for (var i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
  } else {
    binary = unescape(encodeURIComponent(text));
  }
  return btoa(binary).replace(/\//g, '_').replace(/\+/g, '-').replace(/=/g, '');
}

// mpv:// from a subframe is unreliable, so the top frame takes the handover and stays where it is.
// Only when it is reachable: a cross-origin parent can refuse the navigation without saying so,
// and a silent no-op would swallow the whole gesture.
function navigate(url) {
  log(url);
  try {
    if (window.top !== window.self && typeof window.top.location.href === 'string') {
      window.top.location.href = url;
      return;
    }
  } catch (err) {
    log('top frame out of reach', err);
  }
  location.href = url;
}

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
  if (/(^|\.)youtube\.com$/.test(host) || host === 'youtu.be') {
    var id = youtubeVideoId(nurl);
    if (id) {
      popout('https://www.youtube.com/live_chat?is_popout=1&v=' + encodeURIComponent(id));
    }
  } else if (/(^|\.)twitch\.tv$/.test(host)) {
    var channel = nurl.pathname.split('/').filter(Boolean)[0];
    if (channel) {
      popout('https://www.twitch.tv/popout/' + channel + '/chat?popout=');
    }
  } else if (/(^|\.)nimo\.tv$/.test(host)) {
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

function isHlsUrl(url) {
  return hlsdomains.some(function(domain) {
    return url.indexOf(domain) !== -1 || location.hostname.indexOf(domain) !== -1;
  });
}

function EA(attr, type) {
  if (!type) {
    log('no app bound to this direction');
    return;
  }
  attr = String(attr == null ? '' : attr);
  log(attr, type);

  if (attr.startsWith('mpv://')) {
    navigate(attr);
    return;
  }

  var url = /^https?:/i.test(attr) ? attr : location.href;
  var app = 'play';
  var hls = false;

  // A batch beats the dropped link, that is the whole point of collecting them.
  var urls = takeCollected();
  if (urls.length === 0) {
    urls = [url];
  }
  urls.forEach(function(link) {
    if (isHlsUrl(link)) {
      hls = true;
    }
  });
  if (hls && type === 'stream') {
    urls = urls.map(function(link) {
      return link.replace(/^https?:/i, 'hls:');
    });
  }

  if (type === 'pipe') {
    app = 'mpvy';
  } else if (type === 'iptv') {
    app = 'list';
  } else if (type === 'mpv' || type === 'vid') {
    app = 'play';
  } else {
    app = type;
  }

  // protocol_hook.lua splits the payload on whitespace and reads the query after the last slash.
  var query = ['referer=' + GM_btoaUrl(location.href)];
  if (hls === true) {
    query.push('hls=1');
  }
  var url2 = 'mpv://' + app + '/' + GM_btoaUrl(urls.join(' ')) + '/?' + query.join('&');

  if (app === 'stream' && livechat === true) {
    livechatopener(url);
  }
  navigate(url2);
}

// Define the enum-like directory
const DirectionEnum = {
  RIGHT: 6,
  LEFT: 4,
  UP: 2,
  DOWN: 8,
  UP_LEFT: 1,
  UP_RIGHT: 3,
  DOWN_LEFT: 7,
  DOWN_RIGHT: 9
};

function getDirection(x, y, cx, cy) {
  /*=================
  |                 |
  | 1↖   2↑   3↗ |
  |                 |
  | 4←    5    6→ |
  |                 |
  | 7↙   8↓   9↘ |
  |                 |
  |=================*/
  let d, t;
  // A drop outside the window reports 0,0 instead of a position.
  if (cx == 0 && cy == 0) {
    return 5;
  }
  if ((cx - x) >= -DEAD_ZONE && (cx - x) <= DEAD_ZONE && (cy - y) >= -DEAD_ZONE && (cy - y) <= DEAD_ZONE) {
    return 5;
  }
  if (total_direction === 4) { //4 directions
    if (Math.abs(cx - x) < Math.abs(cy - y)) {
      d = cy > y ? 8 : 2;
    } else {
      d = cx > x ? 6 : 4;
    }
  } else { //8 directions
    t = (cy - y) / (cx - x);
    if (-0.4142 <= t && t < 0.4142) d = cx > x ? 6 : 4;
    else if (2.4142 <= t || t < -2.4142) d = cy > y ? 8 : 2;
    else if (0.4142 <= t && t < 2.4142) d = cx > x ? 9 : 1;
    else d = cy > y ? 7 : 3;
  }
  return d;
}

function appForDirection(direction) {
  switch (direction) {
    case DirectionEnum.RIGHT:
      return RIGHT;
    case DirectionEnum.LEFT:
      return LEFT;
    case DirectionEnum.UP:
      return UP;
    case DirectionEnum.DOWN:
      return DOWN;
    case DirectionEnum.UP_LEFT:
      return UP_LEFT;
    case DirectionEnum.UP_RIGHT:
      return UP_RIGHT;
    case DirectionEnum.DOWN_LEFT:
      return DOWN_LEFT;
    case DirectionEnum.DOWN_RIGHT:
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
  EA(dragUrl(e), app);
}, true);

var holdTimer = 0;
var suppressContextMenu = false;

document.addEventListener('mousedown', function(e) {
  // Cleared on every press, otherwise a hold would swallow the menu of the next right click.
  suppressContextMenu = false;
  if (e.button !== 2) {
    return;
  }
  var link = findAnchor(e);
  var href = hrefOf(link);
  if (!href) {
    return;
  }
  var target = eventPath(e)[0];
  var el = (target && target.nodeType === 1) ? target : link;
  clearTimeout(holdTimer);
  holdTimer = setTimeout(function() {
    holdTimer = 0;
    toggleCollected(href, el);
    suppressContextMenu = true;
  }, HOLD_DELAY);
}, true);

document.addEventListener('mouseup', function(e) {
  if (e.button === 2 && holdTimer) {
    clearTimeout(holdTimer);
    holdTimer = 0;
  }
}, true);

document.addEventListener('contextmenu', function(e) {
  if (suppressContextMenu) {
    suppressContextMenu = false;
    e.preventDefault();
  }
}, true);

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
