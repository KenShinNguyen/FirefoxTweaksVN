// ==UserScript==
// @name         MPV-M3U8 Video Detector and Downloader
// @name:en      MPV-M3U8 Video Detector and Downloader
// @version      1.8.0
// @description     Detect m3u8/DASH playlists, Media Source streams and plain videos on any page. Detected links show up in a draggable panel: click a link to copy it, MPV to play it with the page as Referer, or the arrow to download.
// @description:en  Automatically detect the m3u8 video of the page and download it completely. Once detected the m3u8 link, it will appear in the upper right corner of the page. Click download to jump to the m3u8 downloader.
// @icon         https://tools.thatwind.com/favicon.png
// @author       -
// @namespace    https://tools.thatwind.com/
// @homepageURL  https://github.com/KenShinNguyen/FirefoxTweaksVN
// @supportURL   https://github.com/KenShinNguyen/FirefoxTweaksVN/issues
// @downloadURL  https://raw.githubusercontent.com/KenShinNguyen/FirefoxTweaksVN/main/userscript/m3u8.user.js
// @updateURL    https://raw.githubusercontent.com/KenShinNguyen/FirefoxTweaksVN/main/userscript/m3u8.user.js
// @match        *://*/*
// @connect      *
// @grant        unsafeWindow
// @grant        GM_openInTab
// @grant        GM.openInTab
// @grant        GM_getValue
// @grant        GM.getValue
// @grant        GM_setValue
// @grant        GM.setValue
// @grant        GM_deleteValue
// @grant        GM.deleteValue
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @grant        GM_download
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // m3u8-parser is inlined to improve performance and longevity. The bundle is a
    // UMD build, so handing it a local `exports`/`module` keeps it off the globals.
    const m3u8Parser = (function () {
        const exports = {};
        const module = { exports };
/*! @name m3u8-parser @version 7.2.0 @license Apache-2.0 */
!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?e(exports):"function"==typeof define&&define.amd?define(["exports"],e):e((t="undefined"!=typeof globalThis?globalThis:t||self).m3u8Parser={})}(this,(function(t){"use strict";var e=function(){function t(){this.listeners={}}var e=t.prototype;return e.on=function(t,e){this.listeners[t]||(this.listeners[t]=[]),this.listeners[t].push(e)},e.off=function(t,e){if(!this.listeners[t])return!1;var i=this.listeners[t].indexOf(e);return this.listeners[t]=this.listeners[t].slice(0),this.listeners[t].splice(i,1),i>-1},e.trigger=function(t){var e=this.listeners[t];if(e)if(2===arguments.length)for(var i=e.length,s=0;s<i;++s)e[s].call(this,arguments[1]);else for(var a=Array.prototype.slice.call(arguments,1),r=e.length,n=0;n<r;++n)e[n].apply(this,a)},e.dispose=function(){this.listeners={}},e.pipe=function(t){this.on("data",(function(e){t.push(e)}))},t}();class i extends e{constructor(){super(),this.buffer=""}push(t){let e;for(this.buffer+=t,e=this.buffer.indexOf("\n");e>-1;e=this.buffer.indexOf("\n"))this.trigger("data",this.buffer.substring(0,e)),this.buffer=this.buffer.substring(e+1)}}function s(){return a=s=Object.assign||function(t){for(var e=1;e<arguments.length;e++){var i=arguments[e];for(var s in i)Object.prototype.hasOwnProperty.call(i,s)&&(t[s]=i[s])}return t},s.apply(this,arguments)}var a=s,r=a;const n=String.fromCharCode(9),u=function(t){const e=/([0-9.]*)?@?([0-9.]*)?/.exec(t||""),i={};return e[1]&&(i.length=parseInt(e[1],10)),e[2]&&(i.offset=parseInt(e[2],10)),i},o=function(t){const e={};if(!t)return e;const i=t.split(new RegExp('(?:^|,)((?:[^=]*)=(?:"[^"]*"|[^,]*))'));let s,a=i.length;for(;a--;)""!==i[a]&&(s=/([^=]*)=(.*)/.exec(i[a]).slice(1),s[0]=s[0].replace(/^\s+|\s+$/g,""),s[1]=s[1].replace(/^\s+|\s+$/g,""),s[1]=s[1].replace(/^['"](.*)['"]$/g,"$1"),e[s[0]]=s[1]);return e},g=t=>{const e=t.split("x"),i={};return e[0]&&(i.width=parseInt(e[0],10)),e[1]&&(i.height=parseInt(e[1],10)),i};class h extends e{constructor(){super(),this.customParsers=[],this.tagMappers=[]}push(t){let e,i;if(0===(t=t.trim()).length)return;if("#"!==t[0])return void this.trigger("data",{type:"uri",uri:t});this.tagMappers.reduce(((e,i)=>{const s=i(t);return s===t?e:e.concat([s])}),[t]).forEach((t=>{for(let e=0;e<this.customParsers.length;e++)if(this.customParsers[e].call(this,t))return;if(0===t.indexOf("#EXT"))if(t=t.replace("\r",""),e=/^#EXTM3U/.exec(t),e)this.trigger("data",{type:"tag",tagType:"m3u"});else{if(e=/^#EXTINF:([0-9\.]*)?,?(.*)?$/.exec(t),e)return i={type:"tag",tagType:"inf"},e[1]&&(i.duration=parseFloat(e[1])),e[2]&&(i.title=e[2]),void this.trigger("data",i);if(e=/^#EXT-X-TARGETDURATION:([0-9.]*)?/.exec(t),e)return i={type:"tag",tagType:"targetduration"},e[1]&&(i.duration=parseInt(e[1],10)),void this.trigger("data",i);if(e=/^#EXT-X-VERSION:([0-9.]*)?/.exec(t),e)return i={type:"tag",tagType:"version"},e[1]&&(i.version=parseInt(e[1],10)),void this.trigger("data",i);if(e=/^#EXT-X-MEDIA-SEQUENCE:(\-?[0-9.]*)?/.exec(t),e)return i={type:"tag",tagType:"media-sequence"},e[1]&&(i.number=parseInt(e[1],10)),void this.trigger("data",i);if(e=/^#EXT-X-DISCONTINUITY-SEQUENCE:(\-?[0-9.]*)?/.exec(t),e)return i={type:"tag",tagType:"discontinuity-sequence"},e[1]&&(i.number=parseInt(e[1],10)),void this.trigger("data",i);if(e=/^#EXT-X-PLAYLIST-TYPE:(.*)?$/.exec(t),e)return i={type:"tag",tagType:"playlist-type"},e[1]&&(i.playlistType=e[1]),void this.trigger("data",i);if(e=/^#EXT-X-BYTERANGE:(.*)?$/.exec(t),e)return i=r(u(e[1]),{type:"tag",tagType:"byterange"}),void this.trigger("data",i);if(e=/^#EXT-X-ALLOW-CACHE:(YES|NO)?/.exec(t),e)return i={type:"tag",tagType:"allow-cache"},e[1]&&(i.allowed=!/NO/.test(e[1])),void this.trigger("data",i);if(e=/^#EXT-X-MAP:(.*)$/.exec(t),e){if(i={type:"tag",tagType:"map"},e[1]){const t=o(e[1]);t.URI&&(i.uri=t.URI),t.BYTERANGE&&(i.byterange=u(t.BYTERANGE))}this.trigger("data",i)}else{if(e=/^#EXT-X-STREAM-INF:(.*)$/.exec(t),e)return i={type:"tag",tagType:"stream-inf"},e[1]&&(i.attributes=o(e[1]),i.attributes.RESOLUTION&&(i.attributes.RESOLUTION=g(i.attributes.RESOLUTION)),i.attributes.BANDWIDTH&&(i.attributes.BANDWIDTH=parseInt(i.attributes.BANDWIDTH,10)),i.attributes["FRAME-RATE"]&&(i.attributes["FRAME-RATE"]=parseFloat(i.attributes["FRAME-RATE"])),i.attributes["PROGRAM-ID"]&&(i.attributes["PROGRAM-ID"]=parseInt(i.attributes["PROGRAM-ID"],10))),void this.trigger("data",i);if(e=/^#EXT-X-MEDIA:(.*)$/.exec(t),e)return i={type:"tag",tagType:"media"},e[1]&&(i.attributes=o(e[1])),void this.trigger("data",i);if(e=/^#EXT-X-ENDLIST/.exec(t),e)this.trigger("data",{type:"tag",tagType:"endlist"});else if(e=/^#EXT-X-DISCONTINUITY/.exec(t),e)this.trigger("data",{type:"tag",tagType:"discontinuity"});else{if(e=/^#EXT-X-PROGRAM-DATE-TIME:(.*)$/.exec(t),e)return i={type:"tag",tagType:"program-date-time"},e[1]&&(i.dateTimeString=e[1],i.dateTimeObject=new Date(e[1])),void this.trigger("data",i);if(e=/^#EXT-X-KEY:(.*)$/.exec(t),e)return i={type:"tag",tagType:"key"},e[1]&&(i.attributes=o(e[1]),i.attributes.IV&&("0x"===i.attributes.IV.substring(0,2).toLowerCase()&&(i.attributes.IV=i.attributes.IV.substring(2)),i.attributes.IV=i.attributes.IV.match(/.{8}/g),i.attributes.IV[0]=parseInt(i.attributes.IV[0],16),i.attributes.IV[1]=parseInt(i.attributes.IV[1],16),i.attributes.IV[2]=parseInt(i.attributes.IV[2],16),i.attributes.IV[3]=parseInt(i.attributes.IV[3],16),i.attributes.IV=new Uint32Array(i.attributes.IV))),void this.trigger("data",i);if(e=/^#EXT-X-START:(.*)$/.exec(t),e)return i={type:"tag",tagType:"start"},e[1]&&(i.attributes=o(e[1]),i.attributes["TIME-OFFSET"]=parseFloat(i.attributes["TIME-OFFSET"]),i.attributes.PRECISE=/YES/.test(i.attributes.PRECISE)),void this.trigger("data",i);if(e=/^#EXT-X-CUE-OUT-CONT:(.*)?$/.exec(t),e)return i={type:"tag",tagType:"cue-out-cont"},e[1]?i.data=e[1]:i.data="",void this.trigger("data",i);if(e=/^#EXT-X-CUE-OUT:(.*)?$/.exec(t),e)return i={type:"tag",tagType:"cue-out"},e[1]?i.data=e[1]:i.data="",void this.trigger("data",i);if(e=/^#EXT-X-CUE-IN:?(.*)?$/.exec(t),e)return i={type:"tag",tagType:"cue-in"},e[1]?i.data=e[1]:i.data="",void this.trigger("data",i);if(e=/^#EXT-X-SKIP:(.*)$/.exec(t),e&&e[1])return i={type:"tag",tagType:"skip"},i.attributes=o(e[1]),i.attributes.hasOwnProperty("SKIPPED-SEGMENTS")&&(i.attributes["SKIPPED-SEGMENTS"]=parseInt(i.attributes["SKIPPED-SEGMENTS"],10)),i.attributes.hasOwnProperty("RECENTLY-REMOVED-DATERANGES")&&(i.attributes["RECENTLY-REMOVED-DATERANGES"]=i.attributes["RECENTLY-REMOVED-DATERANGES"].split(n)),void this.trigger("data",i);if(e=/^#EXT-X-PART:(.*)$/.exec(t),e&&e[1])return i={type:"tag",tagType:"part"},i.attributes=o(e[1]),["DURATION"].forEach((function(t){i.attributes.hasOwnProperty(t)&&(i.attributes[t]=parseFloat(i.attributes[t]))})),["INDEPENDENT","GAP"].forEach((function(t){i.attributes.hasOwnProperty(t)&&(i.attributes[t]=/YES/.test(i.attributes[t]))})),i.attributes.hasOwnProperty("BYTERANGE")&&(i.attributes.byterange=u(i.attributes.BYTERANGE)),void this.trigger("data",i);if(e=/^#EXT-X-SERVER-CONTROL:(.*)$/.exec(t),e&&e[1])return i={type:"tag",tagType:"server-control"},i.attributes=o(e[1]),["CAN-SKIP-UNTIL","PART-HOLD-BACK","HOLD-BACK"].forEach((function(t){i.attributes.hasOwnProperty(t)&&(i.attributes[t]=parseFloat(i.attributes[t]))})),["CAN-SKIP-DATERANGES","CAN-BLOCK-RELOAD"].forEach((function(t){i.attributes.hasOwnProperty(t)&&(i.attributes[t]=/YES/.test(i.attributes[t]))})),void this.trigger("data",i);if(e=/^#EXT-X-PART-INF:(.*)$/.exec(t),e&&e[1])return i={type:"tag",tagType:"part-inf"},i.attributes=o(e[1]),["PART-TARGET"].forEach((function(t){i.attributes.hasOwnProperty(t)&&(i.attributes[t]=parseFloat(i.attributes[t]))})),void this.trigger("data",i);if(e=/^#EXT-X-PRELOAD-HINT:(.*)$/.exec(t),e&&e[1])return i={type:"tag",tagType:"preload-hint"},i.attributes=o(e[1]),["BYTERANGE-START","BYTERANGE-LENGTH"].forEach((function(t){if(i.attributes.hasOwnProperty(t)){i.attributes[t]=parseInt(i.attributes[t],10);const e="BYTERANGE-LENGTH"===t?"length":"offset";i.attributes.byterange=i.attributes.byterange||{},i.attributes.byterange[e]=i.attributes[t],delete i.attributes[t]}})),void this.trigger("data",i);if(e=/^#EXT-X-RENDITION-REPORT:(.*)$/.exec(t),e&&e[1])return i={type:"tag",tagType:"rendition-report"},i.attributes=o(e[1]),["LAST-MSN","LAST-PART"].forEach((function(t){i.attributes.hasOwnProperty(t)&&(i.attributes[t]=parseInt(i.attributes[t],10))})),void this.trigger("data",i);if(e=/^#EXT-X-DATERANGE:(.*)$/.exec(t),e&&e[1]){i={type:"tag",tagType:"daterange"},i.attributes=o(e[1]),["ID","CLASS"].forEach((function(t){i.attributes.hasOwnProperty(t)&&(i.attributes[t]=String(i.attributes[t]))})),["START-DATE","END-DATE"].forEach((function(t){i.attributes.hasOwnProperty(t)&&(i.attributes[t]=new Date(i.attributes[t]))})),["DURATION","PLANNED-DURATION"].forEach((function(t){i.attributes.hasOwnProperty(t)&&(i.attributes[t]=parseFloat(i.attributes[t]))})),["END-ON-NEXT"].forEach((function(t){i.attributes.hasOwnProperty(t)&&(i.attributes[t]=/YES/i.test(i.attributes[t]))})),["SCTE35-CMD"," SCTE35-OUT","SCTE35-IN"].forEach((function(t){i.attributes.hasOwnProperty(t)&&(i.attributes[t]=i.attributes[t].toString(16))}));const t=/^X-([A-Z]+-)+[A-Z]+$/;for(const e in i.attributes){if(!t.test(e))continue;const s=/[0-9A-Fa-f]{6}/g.test(i.attributes[e]),a=/^\d+(\.\d+)?$/.test(i.attributes[e]);i.attributes[e]=s?i.attributes[e].toString(16):a?parseFloat(i.attributes[e]):String(i.attributes[e])}this.trigger("data",i)}else if(e=/^#EXT-X-INDEPENDENT-SEGMENTS/.exec(t),e)this.trigger("data",{type:"tag",tagType:"independent-segments"});else if(e=/^#EXT-X-I-FRAMES-ONLY/.exec(t),e)this.trigger("data",{type:"tag",tagType:"i-frames-only"});else{if(e=/^#EXT-X-CONTENT-STEERING:(.*)$/.exec(t),e)return i={type:"tag",tagType:"content-steering"},i.attributes=o(e[1]),void this.trigger("data",i);if(e=/^#EXT-X-I-FRAME-STREAM-INF:(.*)$/.exec(t),e)return i={type:"tag",tagType:"i-frame-playlist"},i.attributes=o(e[1]),i.attributes.URI&&(i.uri=i.attributes.URI),i.attributes.BANDWIDTH&&(i.attributes.BANDWIDTH=parseInt(i.attributes.BANDWIDTH,10)),i.attributes.RESOLUTION&&(i.attributes.RESOLUTION=g(i.attributes.RESOLUTION)),i.attributes["AVERAGE-BANDWIDTH"]&&(i.attributes["AVERAGE-BANDWIDTH"]=parseInt(i.attributes["AVERAGE-BANDWIDTH"],10)),i.attributes["FRAME-RATE"]&&(i.attributes["FRAME-RATE"]=parseFloat(i.attributes["FRAME-RATE"])),void this.trigger("data",i);if(e=/^#EXT-X-DEFINE:(.*)$/.exec(t),e)return i={type:"tag",tagType:"define"},i.attributes=o(e[1]),void this.trigger("data",i);this.trigger("data",{type:"tag",data:t.slice(4)})}}}}else this.trigger("data",{type:"comment",text:t.slice(1)})}))}addParser({expression:t,customType:e,dataParser:i,segment:s}){"function"!=typeof i&&(i=t=>t),this.customParsers.push((a=>{if(t.exec(a))return this.trigger("data",{type:"custom",data:i(a),customType:e,segment:s}),!0}))}addTagMapper({expression:t,map:e}){this.tagMappers.push((i=>t.test(i)?e(i):i))}}function E(t){for(var e,i=(e=t,window.atob?window.atob(e):Buffer.from(e,"base64").toString("binary")),s=new Uint8Array(i.length),a=0;a<i.length;a++)s[a]=i.charCodeAt(a);return s}const d=function(t){const e={};return Object.keys(t).forEach((function(i){var s;e[(s=i,s.toLowerCase().replace(/-(\w)/g,(t=>t[1].toUpperCase())))]=t[i]})),e},f=function(t){const{serverControl:e,targetDuration:i,partTargetDuration:s}=t;if(!e)return;const a="#EXT-X-SERVER-CONTROL",r="holdBack",n="partHoldBack",u=i&&3*i,o=s&&2*s;i&&!e.hasOwnProperty(r)&&(e[r]=u,this.trigger("info",{message:`${a} defaulting HOLD-BACK to targetDuration * 3 (${u}).`})),u&&e[r]<u&&(this.trigger("warn",{message:`${a} clamping HOLD-BACK (${e[r]}) to targetDuration * 3 (${u})`}),e[r]=u),s&&!e.hasOwnProperty(n)&&(e[n]=3*s,this.trigger("info",{message:`${a} defaulting PART-HOLD-BACK to partTargetDuration * 3 (${e[n]}).`})),s&&e[n]<o&&(this.trigger("warn",{message:`${a} clamping PART-HOLD-BACK (${e[n]}) to partTargetDuration * 2 (${o}).`}),e[n]=o)};t.LineStream=i,t.ParseStream=h,t.Parser=class extends e{constructor(t={}){super(),this.lineStream=new i,this.parseStream=new h,this.lineStream.pipe(this.parseStream),this.mainDefinitions=t.mainDefinitions||{},this.params=new URL(t.uri,"https://a.com").searchParams,this.lastProgramDateTime=null;const e=this,s=[];let a,n,u={},o=!1;const g=function(){},p={AUDIO:{},VIDEO:{},"CLOSED-CAPTIONS":{},SUBTITLES:{}};let T=0;this.manifest={allowCache:!0,discontinuityStarts:[],dateRanges:[],iFramePlaylists:[],segments:[]};let m=0,b=0;const c={};this.on("end",(()=>{u.uri||!u.parts&&!u.preloadHints||(!u.map&&a&&(u.map=a),!u.key&&n&&(u.key=n),u.timeline||"number"!=typeof T||(u.timeline=T),this.manifest.preloadSegment=u)})),this.parseStream.on("data",(function(t){let i,h;if(e.manifest.definitions)for(const i in e.manifest.definitions)if(t.uri&&(t.uri=t.uri.replace(`{${i}}`,e.manifest.definitions[i])),t.attributes)for(const s in t.attributes)"string"==typeof t.attributes[s]&&(t.attributes[s]=t.attributes[s].replace(`{${i}}`,e.manifest.definitions[i]));({tag(){({version(){t.version&&(this.manifest.version=t.version)},"allow-cache"(){this.manifest.allowCache=t.allowed,"allowed"in t||(this.trigger("info",{message:"defaulting allowCache to YES"}),this.manifest.allowCache=!0)},byterange(){const e={};"length"in t&&(u.byterange=e,e.length=t.length,"offset"in t||(t.offset=m)),"offset"in t&&(u.byterange=e,e.offset=t.offset),m=e.offset+e.length},endlist(){this.manifest.endList=!0},inf(){"mediaSequence"in this.manifest||(this.manifest.mediaSequence=0,this.trigger("info",{message:"defaulting media sequence to zero"})),"discontinuitySequence"in this.manifest||(this.manifest.discontinuitySequence=0,this.trigger("info",{message:"defaulting discontinuity sequence to zero"})),t.title&&(u.title=t.title),t.duration>0&&(u.duration=t.duration),0===t.duration&&(u.duration=.01,this.trigger("info",{message:"updating zero segment duration to a small value"})),this.manifest.segments=s},key(){if(t.attributes)if("NONE"!==t.attributes.METHOD)if(t.attributes.URI){if("com.apple.streamingkeydelivery"===t.attributes.KEYFORMAT)return this.manifest.contentProtection=this.manifest.contentProtection||{},void(this.manifest.contentProtection["com.apple.fps.1_0"]={attributes:t.attributes});if("com.microsoft.playready"===t.attributes.KEYFORMAT)return this.manifest.contentProtection=this.manifest.contentProtection||{},void(this.manifest.contentProtection["com.microsoft.playready"]={uri:t.attributes.URI});if("urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"===t.attributes.KEYFORMAT){return-1===["SAMPLE-AES","SAMPLE-AES-CTR","SAMPLE-AES-CENC"].indexOf(t.attributes.METHOD)?void this.trigger("warn",{message:"invalid key method provided for Widevine"}):("SAMPLE-AES-CENC"===t.attributes.METHOD&&this.trigger("warn",{message:"SAMPLE-AES-CENC is deprecated, please use SAMPLE-AES-CTR instead"}),"data:text/plain;base64,"!==t.attributes.URI.substring(0,23)?void this.trigger("warn",{message:"invalid key URI provided for Widevine"}):t.attributes.KEYID&&"0x"===t.attributes.KEYID.substring(0,2)?(this.manifest.contentProtection=this.manifest.contentProtection||{},void(this.manifest.contentProtection["com.widevine.alpha"]={attributes:{schemeIdUri:t.attributes.KEYFORMAT,keyId:t.attributes.KEYID.substring(2)},pssh:E(t.attributes.URI.split(",")[1])})):void this.trigger("warn",{message:"invalid key ID provided for Widevine"}))}t.attributes.METHOD||this.trigger("warn",{message:"defaulting key method to AES-128"}),n={method:t.attributes.METHOD||"AES-128",uri:t.attributes.URI},void 0!==t.attributes.IV&&(n.iv=t.attributes.IV)}else this.trigger("warn",{message:"ignoring key declaration without URI"});else n=null;else this.trigger("warn",{message:"ignoring key declaration without attribute list"})},"media-sequence"(){isFinite(t.number)?this.manifest.mediaSequence=t.number:this.trigger("warn",{message:"ignoring invalid media sequence: "+t.number})},"discontinuity-sequence"(){isFinite(t.number)?(this.manifest.discontinuitySequence=t.number,T=t.number):this.trigger("warn",{message:"ignoring invalid discontinuity sequence: "+t.number})},"playlist-type"(){/VOD|EVENT/.test(t.playlistType)?this.manifest.playlistType=t.playlistType:this.trigger("warn",{message:"ignoring unknown playlist type: "+t.playlist})},map(){a={},t.uri&&(a.uri=t.uri),t.byterange&&(a.byterange=t.byterange),n&&(a.key=n)},"stream-inf"(){this.manifest.playlists=s,this.manifest.mediaGroups=this.manifest.mediaGroups||p,t.attributes?(u.attributes||(u.attributes={}),r(u.attributes,t.attributes)):this.trigger("warn",{message:"ignoring empty stream-inf attributes"})},media(){if(this.manifest.mediaGroups=this.manifest.mediaGroups||p,!(t.attributes&&t.attributes.TYPE&&t.attributes["GROUP-ID"]&&t.attributes.NAME))return void this.trigger("warn",{message:"ignoring incomplete or missing media group"});const e=this.manifest.mediaGroups[t.attributes.TYPE];e[t.attributes["GROUP-ID"]]=e[t.attributes["GROUP-ID"]]||{},i=e[t.attributes["GROUP-ID"]],h={default:/yes/i.test(t.attributes.DEFAULT)},h.default?h.autoselect=!0:h.autoselect=/yes/i.test(t.attributes.AUTOSELECT),t.attributes.LANGUAGE&&(h.language=t.attributes.LANGUAGE),t.attributes.URI&&(h.uri=t.attributes.URI),t.attributes["INSTREAM-ID"]&&(h.instreamId=t.attributes["INSTREAM-ID"]),t.attributes.CHARACTERISTICS&&(h.characteristics=t.attributes.CHARACTERISTICS),t.attributes.FORCED&&(h.forced=/yes/i.test(t.attributes.FORCED)),i[t.attributes.NAME]=h},discontinuity(){T+=1,u.discontinuity=!0,this.manifest.discontinuityStarts.push(s.length)},"program-date-time"(){void 0===this.manifest.dateTimeString&&(this.manifest.dateTimeString=t.dateTimeString,this.manifest.dateTimeObject=t.dateTimeObject),u.dateTimeString=t.dateTimeString,u.dateTimeObject=t.dateTimeObject;const{lastProgramDateTime:e}=this;this.lastProgramDateTime=new Date(t.dateTimeString).getTime(),null===e&&this.manifest.segments.reduceRight(((t,e)=>(e.programDateTime=t-1e3*e.duration,e.programDateTime)),this.lastProgramDateTime)},targetduration(){!isFinite(t.duration)||t.duration<0?this.trigger("warn",{message:"ignoring invalid target duration: "+t.duration}):(this.manifest.targetDuration=t.duration,f.call(this,this.manifest))},start(){t.attributes&&!isNaN(t.attributes["TIME-OFFSET"])?this.manifest.start={timeOffset:t.attributes["TIME-OFFSET"],precise:t.attributes.PRECISE}:this.trigger("warn",{message:"ignoring start declaration without appropriate attribute list"})},"cue-out"(){u.cueOut=t.data},"cue-out-cont"(){u.cueOutCont=t.data},"cue-in"(){u.cueIn=t.data},skip(){this.manifest.skip=d(t.attributes),this.warnOnMissingAttributes_("#EXT-X-SKIP",t.attributes,["SKIPPED-SEGMENTS"])},part(){o=!0;const e=this.manifest.segments.length,i=d(t.attributes);u.parts=u.parts||[],u.parts.push(i),i.byterange&&(i.byterange.hasOwnProperty("offset")||(i.byterange.offset=b),b=i.byterange.offset+i.byterange.length);const s=u.parts.length-1;this.warnOnMissingAttributes_(`#EXT-X-PART #${s} for segment #${e}`,t.attributes,["URI","DURATION"]),this.manifest.renditionReports&&this.manifest.renditionReports.forEach(((t,e)=>{t.hasOwnProperty("lastPart")||this.trigger("warn",{message:`#EXT-X-RENDITION-REPORT #${e} lacks required attribute(s): LAST-PART`})}))},"server-control"(){const e=this.manifest.serverControl=d(t.attributes);e.hasOwnProperty("canBlockReload")||(e.canBlockReload=!1,this.trigger("info",{message:"#EXT-X-SERVER-CONTROL defaulting CAN-BLOCK-RELOAD to false"})),f.call(this,this.manifest),e.canSkipDateranges&&!e.hasOwnProperty("canSkipUntil")&&this.trigger("warn",{message:"#EXT-X-SERVER-CONTROL lacks required attribute CAN-SKIP-UNTIL which is required when CAN-SKIP-DATERANGES is set"})},"preload-hint"(){const e=this.manifest.segments.length,i=d(t.attributes),s=i.type&&"PART"===i.type;u.preloadHints=u.preloadHints||[],u.preloadHints.push(i),i.byterange&&(i.byterange.hasOwnProperty("offset")||(i.byterange.offset=s?b:0,s&&(b=i.byterange.offset+i.byterange.length)));const a=u.preloadHints.length-1;if(this.warnOnMissingAttributes_(`#EXT-X-PRELOAD-HINT #${a} for segment #${e}`,t.attributes,["TYPE","URI"]),i.type)for(let t=0;t<u.preloadHints.length-1;t++){const s=u.preloadHints[t];s.type&&(s.type===i.type&&this.trigger("warn",{message:`#EXT-X-PRELOAD-HINT #${a} for segment #${e} has the same TYPE ${i.type} as preload hint #${t}`}))}},"rendition-report"(){const e=d(t.attributes);this.manifest.renditionReports=this.manifest.renditionReports||[],this.manifest.renditionReports.push(e);const i=this.manifest.renditionReports.length-1,s=["LAST-MSN","URI"];o&&s.push("LAST-PART"),this.warnOnMissingAttributes_(`#EXT-X-RENDITION-REPORT #${i}`,t.attributes,s)},"part-inf"(){this.manifest.partInf=d(t.attributes),this.warnOnMissingAttributes_("#EXT-X-PART-INF",t.attributes,["PART-TARGET"]),this.manifest.partInf.partTarget&&(this.manifest.partTargetDuration=this.manifest.partInf.partTarget),f.call(this,this.manifest)},daterange(){this.manifest.dateRanges.push(d(t.attributes));const e=this.manifest.dateRanges.length-1;this.warnOnMissingAttributes_(`#EXT-X-DATERANGE #${e}`,t.attributes,["ID","START-DATE"]);const i=this.manifest.dateRanges[e];i.endDate&&i.startDate&&new Date(i.endDate)<new Date(i.startDate)&&this.trigger("warn",{message:"EXT-X-DATERANGE END-DATE must be equal to or later than the value of the START-DATE"}),i.duration&&i.duration<0&&this.trigger("warn",{message:"EXT-X-DATERANGE DURATION must not be negative"}),i.plannedDuration&&i.plannedDuration<0&&this.trigger("warn",{message:"EXT-X-DATERANGE PLANNED-DURATION must not be negative"});const s=!!i.endOnNext;if(s&&!i.class&&this.trigger("warn",{message:"EXT-X-DATERANGE with an END-ON-NEXT=YES attribute must have a CLASS attribute"}),s&&(i.duration||i.endDate)&&this.trigger("warn",{message:"EXT-X-DATERANGE with an END-ON-NEXT=YES attribute must not contain DURATION or END-DATE attributes"}),i.duration&&i.endDate){const t=i.startDate.getTime()+1e3*i.duration;this.manifest.dateRanges[e].endDate=new Date(t)}if(c[i.id]){for(const t in c[i.id])if(i[t]&&JSON.stringify(c[i.id][t])!==JSON.stringify(i[t])){this.trigger("warn",{message:"EXT-X-DATERANGE tags with the same ID in a playlist must have the same attributes values"});break}const t=this.manifest.dateRanges.findIndex((t=>t.id===i.id));this.manifest.dateRanges[t]=r(this.manifest.dateRanges[t],i),c[i.id]=r(c[i.id],i),this.manifest.dateRanges.pop()}else c[i.id]=i},"independent-segments"(){this.manifest.independentSegments=!0},"i-frames-only"(){this.manifest.iFramesOnly=!0,this.requiredCompatibilityversion(this.manifest.version,4)},"content-steering"(){this.manifest.contentSteering=d(t.attributes),this.warnOnMissingAttributes_("#EXT-X-CONTENT-STEERING",t.attributes,["SERVER-URI"])},define(){this.manifest.definitions=this.manifest.definitions||{};const e=(t,e)=>{t in this.manifest.definitions?this.trigger("error",{message:`EXT-X-DEFINE: Duplicate name ${t}`}):this.manifest.definitions[t]=e};if("QUERYPARAM"in t.attributes){if("NAME"in t.attributes||"IMPORT"in t.attributes)return void this.trigger("error",{message:"EXT-X-DEFINE: Invalid attributes"});const i=this.params.get(t.attributes.QUERYPARAM);return i?void e(t.attributes.QUERYPARAM,decodeURIComponent(i)):void this.trigger("error",{message:`EXT-X-DEFINE: No query param ${t.attributes.QUERYPARAM}`})}return"NAME"in t.attributes?"IMPORT"in t.attributes?void this.trigger("error",{message:"EXT-X-DEFINE: Invalid attributes"}):"VALUE"in t.attributes&&"string"==typeof t.attributes.VALUE?void e(t.attributes.NAME,t.attributes.VALUE):void this.trigger("error",{message:`EXT-X-DEFINE: No value for ${t.attributes.NAME}`}):"IMPORT"in t.attributes?this.mainDefinitions[t.attributes.IMPORT]?void e(t.attributes.IMPORT,this.mainDefinitions[t.attributes.IMPORT]):void this.trigger("error",{message:`EXT-X-DEFINE: No value ${t.attributes.IMPORT} to import, or IMPORT used on main playlist`}):void this.trigger("error",{message:"EXT-X-DEFINE: No attribute"})},"i-frame-playlist"(){this.manifest.iFramePlaylists.push({attributes:t.attributes,uri:t.uri,timeline:T}),this.warnOnMissingAttributes_("#EXT-X-I-FRAME-STREAM-INF",t.attributes,["BANDWIDTH","URI"])}}[t.tagType]||g).call(e)},uri(){u.uri=t.uri,s.push(u),this.manifest.targetDuration&&!("duration"in u)&&(this.trigger("warn",{message:"defaulting segment duration to the target duration"}),u.duration=this.manifest.targetDuration),n&&(u.key=n),u.timeline=T,a&&(u.map=a),b=0,null!==this.lastProgramDateTime&&(u.programDateTime=this.lastProgramDateTime,this.lastProgramDateTime+=1e3*u.duration),u={}},comment(){},custom(){t.segment?(u.custom=u.custom||{},u.custom[t.customType]=t.data):(this.manifest.custom=this.manifest.custom||{},this.manifest.custom[t.customType]=t.data)}})[t.type].call(e)}))}requiredCompatibilityversion(t,e){(t<e||!t)&&this.trigger("warn",{message:`manifest must be at least version ${e}`})}warnOnMissingAttributes_(t,e,i){const s=[];i.forEach((function(t){e.hasOwnProperty(t)||s.push(t)})),s.length&&this.trigger("warn",{message:`${t} lacks required attribute(s): ${s.join(", ")}`})}push(t){this.lineStream.push(t)}end(){this.lineStream.push("\n"),this.manifest.dateRanges.length&&null===this.lastProgramDateTime&&this.trigger("warn",{message:"A playlist with EXT-X-DATERANGE tag must contain atleast one EXT-X-PROGRAM-DATE-TIME tag"}),this.lastProgramDateTime=null,this.trigger("end")}addParser(t){this.parseStream.addParser(t)}addTagMapper(t){this.parseStream.addTagMapper(t)}},Object.defineProperty(t,"__esModule",{value:!0})}));
        return exports;
    })();

    // Some managers start the script before <html> exists, so nothing may assume
    // document.documentElement is already there.
    function appendToRoot(node) {
        if (document.documentElement) document.documentElement.appendChild(node);
        else setTimeout(() => appendToRoot(node), 0);
    }

    const mgmapi = {

        addStyle(s) {
            let style = document.createElement("style");
            style.innerHTML = s;
            appendToRoot(style);
        },
        async getValue(name, defaultVal) {
            return await ((typeof GM_getValue === "function") ? GM_getValue : GM.getValue)(name, defaultVal);
        },
        async setValue(name, value) {
            return await ((typeof GM_setValue === "function") ? GM_setValue : GM.setValue)(name, value);
        },
        async deleteValue(name) {
            return await ((typeof GM_deleteValue === "function") ? GM_deleteValue : GM.deleteValue)(name);
        },
        openInTab(url, open_in_background = false) {
            return ((typeof GM_openInTab === "function") ? GM_openInTab : GM.openInTab)(url, open_in_background);
        },
        xmlHttpRequest(details) {
            return ((typeof GM_xmlhttpRequest === "function") ? GM_xmlhttpRequest : GM.xmlHttpRequest)(details);
        },
        download(details) {
            if (typeof GM_download === "function") {
                this.message("下载中，请留意浏览器下载弹窗\nDownloading, pay attention to the browser's download pop-up.", 3000);
                try {
                    return GM_download(details);
                } catch {
                    // Some managers reject the request outright (header policy, missing
                    // permission); fall back to opening the file in a tab.
                }
            }
            return this.openInTab(details.url);
        },
        async copyText(text) {
            try {
                await navigator.clipboard.writeText(text);
                return;
            } catch {
                // Clipboard API needs a secure context and permission; fall through.
            }
            const host = document.body || document.documentElement;
            if (!host) return;
            const copyFrom = document.createElement("textarea");
            copyFrom.textContent = text;
            host.appendChild(copyFrom);
            copyFrom.select();
            document.execCommand('copy');
            copyFrom.blur();
            host.removeChild(copyFrom);
        },
        message(text, disappearTime = 5000) {
            const id = "f8243rd238-gm-message-panel";
            const host = document.body || document.documentElement;
            if (!host) return;
            let p = document.querySelector(`#${id}`);
            if (!p) {
                p = document.createElement("div");
                p.id = id;
                p.style = `
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    display: flex;
                    flex-direction: column;
                    align-items: end;
                    z-index: 999999999999999;
                `;
                host.appendChild(p);
            }
            let mdiv = document.createElement("div");
            mdiv.innerText = text;
            mdiv.style = `
                padding: 3px 8px;
                border-radius: 5px;
                background: black;
                box-shadow: #000 1px 2px 5px;
                margin-top: 10px;
                font-size: small;
                color: #fff;
                text-align: right;
            `;
            p.appendChild(mdiv);
            setTimeout(() => {
                if (mdiv.parentNode) mdiv.parentNode.removeChild(mdiv);
            }, disappearTime);
        }
    };


    if (location.host === "tools.thatwind.com" || location.host === "localhost:3000") {
        mgmapi.addStyle("#userscript-tip{display:none !important;}");

        // 对请求做代理
        // Proxy requests the downloader page cannot make itself (CORS).
        const _fetch = unsafeWindow.fetch;
        unsafeWindow.fetch = async function (...args) {
            try {
                let response = await _fetch(...args);
                if (!response.ok) throw new Error(response.status);
                return response;
            } catch (e) {
                // 失败请求使用代理
                if (args.length == 1) {
                    console.log(`请求代理：${args[0]}`);
                    return await new Promise((resolve, reject) => {
                        let referer = new URLSearchParams(location.hash.slice(1)).get("referer");
                        let headers = {};
                        if (referer) {
                            try {
                                referer = new URL(referer);
                                headers = {
                                    "origin": referer.origin,
                                    "referer": referer.href
                                };
                            } catch {
                                // Malformed referer in the hash: send the request without it.
                            }
                        }
                        mgmapi.xmlHttpRequest({
                            method: "GET",
                            url: args[0],
                            responseType: 'arraybuffer',
                            headers,
                            onload(r) {
                                resolve({
                                    status: r.status,
                                    headers: new Headers(String(r.responseHeaders || "").split(/\r?\n/).filter(n => n.includes(":")).map(s => s.split(/:\s*/)).reduce((all, [a, ...b]) => { all[a] = b.join(":"); return all; }, {})),
                                    async text() {
                                        return r.responseText;
                                    },
                                    async arrayBuffer() {
                                        return r.response;
                                    }
                                });
                            },
                            onerror() {
                                reject(new Error(`proxy request failed: ${args[0]}`));
                            }
                        });
                    });
                } else {
                    throw e;
                }
            }
        }

        return;
    }


    // iframe 信息交流
    // 目前只用于获取顶部标题
    // iframe messaging, used only to read the top frame's title.
    const TITLE_REQUEST = "3j4t9uj349-gm-get-title";
    const TITLE_RESPONSE = "3j4t9uj349-gm-top-title-name:";

    window.addEventListener("message", async (e) => {
        if (e.data !== TITLE_REQUEST || !e.source) return;
        const name = `top-title-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        await mgmapi.setValue(name, document.title);
        // Any frame can ask, so drop the key even when the asker never reads it —
        // otherwise storage grows without bound.
        setTimeout(() => mgmapi.deleteValue(name), 30000);
        e.source.postMessage(TITLE_RESPONSE + name, "*");
    });

    function getTopTitle() {
        return new Promise(resolve => {
            let settled = false;
            const finish = (title) => {
                if (settled) return;
                settled = true;
                window.removeEventListener("message", onMessage);
                resolve(title || "");
            };

            async function onMessage(e) {
                if (typeof e.data !== "string" || !e.data.startsWith(TITLE_RESPONSE)) return;
                const name = e.data.slice(TITLE_RESPONSE.length);
                await new Promise(r => setTimeout(r, 5)); // 等5毫秒 确定 setValue 已经写入
                finish(await mgmapi.getValue(name));
                mgmapi.deleteValue(name);
            }

            window.addEventListener("message", onMessage);
            // Never leave a download click hanging when the top frame does not answer.
            setTimeout(() => finish(""), 2000);
            try {
                window.top.postMessage(TITLE_REQUEST, "*");
            } catch {
                finish("");
            }
        });
    }


    let count = 0;

    // A page can stay open for hours — a live stream rotating its playlist urls,
    // an SPA swapping players — so nothing keyed by url may grow without end.
    // Entries drop out on age, or least-recently-used first once the cap is hit.
    class LruTtl {
        constructor(max, ttlMs) {
            this.max = max;
            this.ttl = ttlMs;
            this.entries = new Map();
        }
        get(key) {
            const entry = this.entries.get(key);
            if (!entry) return undefined;
            // The stamp is the insert time, not the last read: an entry is stale
            // once it is old, however often it has been looked at since.
            if (Date.now() - entry.at > this.ttl) {
                this.entries.delete(key);
                return undefined;
            }
            // A Map iterates in insertion order, so re-inserting an entry is what
            // marks it as the most recently used one.
            this.entries.delete(key);
            this.entries.set(key, entry);
            return entry.value;
        }
        has(key) {
            return this.get(key) !== undefined;
        }
        set(key, value) {
            this.entries.delete(key);
            this.entries.set(key, { value, at: Date.now() });
            while (this.entries.size > this.max) {
                this.entries.delete(this.entries.keys().next().value);
            }
        }
        delete(key) {
            this.entries.delete(key);
        }
        get size() {
            return this.entries.size;
        }
    }

    // Half an hour outlives any player's re-request of the same playlist, so an
    // eviction costing a duplicate row is already unlikely; showVideo checks the
    // rendered rows before adding one, so it cannot happen at all.
    const shownUrls = new LruTtl(500, 30 * 60 * 1000);

    // An MSE stream never exposes a url this panel could otherwise see: the player
    // fetches segments itself, feeds them to a MediaSource, and points the <video>
    // at a blob. Recording which object urls belong to a MediaSource is what lets
    // the video check tell such a player apart from an ordinary blob video.
    const mseCodecs = new WeakMap();
    // Bounded for the same reason shownUrls is — a player that rebuilds its
    // MediaSource on every ad break mints a fresh object url each time — and held
    // through a WeakRef so a stale entry cannot pin a dead MediaSource in memory.
    const mseObjectUrls = new LruTtl(64, 60 * 60 * 1000);

    function downloaderUrl(m3u8, filename) {
        return `https://tools.thatwind.com/tool/m3u8downloader#${new URLSearchParams({
            m3u8,
            referer: location.href,
            filename: filename || ""
        })}`;
    }

    function formatDuration(seconds) {
        // Live streams report Infinity, and an unparsed manifest reports 0.
        if (!Number.isFinite(seconds) || seconds <= 0) return "未知(unknown)";
        return `${Math.ceil(seconds * 10 / 60) / 10} mins`;
    }

    // Both sniffers name the kind of stream rather than answering yes/no, so a
    // DASH manifest is not mistaken for a playlist further down.
    function sniffUrl(url) {
        if (!url) return null;
        let parsed;
        try {
            parsed = new URL(url, location.href);
        } catch {
            return null;
        }
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
        // 发现 / found one
        if (parsed.pathname.includes(".m3u8") || parsed.pathname.includes(".m3u")) return "m3u8";
        if (parsed.pathname.includes(".mpd")) return "mpd";
        return null;
    }

    function sniffContent(content) {
        // Look at the head only: a response body can be megabytes long.
        if (typeof content !== "string") return null;
        const head = content.slice(0, 512).trim();
        if (head.startsWith("#EXTM3U")) return "m3u8";
        // A DASH manifest is XML rooted at <MPD>, which an xml declaration, a
        // comment or a namespace prefix may precede.
        if (head.startsWith("<") && /<(?:[\w.-]+:)?MPD[\s>]/.test(head)) return "mpd";
        return null;
    }

    function describeHls(content, uri) {
        // Passing the uri lets the parser resolve EXT-X-DEFINE query params.
        const parser = new m3u8Parser.Parser({ uri });
        parser.push(content);
        parser.end();
        const manifest = parser.manifest;

        if (manifest.segments && manifest.segments.length) {
            return formatDuration(manifest.segments.reduce((total, segment) => total + (segment.duration || 0), 0));
        }
        if (manifest.playlists && manifest.playlists.length) {
            return `多(Multi)(${manifest.playlists.length})`;
        }
        return "未知(unknown)";
    }

    // MPD durations are ISO 8601, e.g. PT1H2M3.5S. Years and months are not
    // convertible to seconds without a calendar and never appear in a manifest, so
    // a duration using them reads as unknown rather than as a confidently wrong
    // number.
    function parseIsoDuration(value) {
        const m = /^P(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/
            .exec(String(value == null ? "" : value).trim());
        if (!m) return 0;
        const part = (i) => (m[i] === undefined ? 0 : parseFloat(m[i]));
        return part(1) * 604800 + part(2) * 86400 + part(3) * 3600 + part(4) * 60 + part(5);
    }

    // Returns null when the body turns out not to be a DASH manifest after all, so
    // the caller can drop the url instead of listing a row for it.
    function describeDash(content) {
        let doc;
        try {
            doc = new DOMParser().parseFromString(content, "application/xml");
        } catch {
            return null;
        }
        // A parse failure is reported as a document containing <parsererror>
        // rather than as a thrown error.
        if (doc.getElementsByTagName("parsererror").length) return null;

        const mpd = doc.documentElement;
        // localName rather than tagName: a manifest may carry a namespace prefix.
        if (!mpd || mpd.localName !== "MPD") return null;

        if (mpd.getAttribute("type") === "dynamic") return "直播(live)";

        const seconds = parseIsoDuration(mpd.getAttribute("mediaPresentationDuration"));
        if (seconds > 0) return formatDuration(seconds);

        const representations = doc.getElementsByTagName("Representation").length;
        return representations ? `多(Multi)(${representations})` : "未知(unknown)";
    }

    // The url-safe base64 that mpv/scripts/protocol_hook.lua decodes (atobUrl maps
    // _ back to / and - back to +). Encoding the UTF-8 bytes keeps btoa from
    // throwing on non-latin1 urls; for ascii it is byte for byte the same.
    function b64url(str) {
        let binary = "";
        for (const byte of new TextEncoder().encode(str)) binary += String.fromCharCode(byte);
        return btoa(binary).replace(/\//g, "_").replace(/\+/g, "-").replace(/=/g, "");
    }

    // Same shape Handlers Helper builds, so the existing protocol handler applies:
    // mpv://<app>/<url>/?referer=<page>. Without the referer most CDNs answer 403,
    // which is why a bare link pasted into mpv plays nothing.
    function mpvUrl(mediaUrl) {
        return `mpv://play/${b64url(mediaUrl)}/?referer=${b64url(location.href)}`;
    }

    // The frame url is only worth listing once this frame turns out to hold media,
    // otherwise every ad and tracking iframe on the page adds a row.
    let iframeListed = false;
    function listIframeOnce() {
        if (iframeListed || window.top === window.self) return;
        iframeListed = true;
        showVideo({
            type: "iframe",
            url: new URL(location.href),
            duration: "unknown",
            async download() {
                mgmapi.openInTab(downloaderUrl(location.href, await getTopTitle()));
            }
        });
    }

    const rootDiv = document.createElement("div");
    rootDiv.style = `
        position: fixed;
        z-index: 9999999999999999;
        opacity: 0.9;
    `;
    rootDiv.style.display = "none";
    appendToRoot(rootDiv);

    const shadowDOM = rootDiv.attachShadow({ mode: 'open' });
    const wrapper = document.createElement("div");
    shadowDOM.appendChild(wrapper);


    // 指示器 / counter badge
    const bar = document.createElement("div");
    bar.style = `
        text-align: right;
    `;
    bar.innerHTML = `
        <span
            class="number-indicator"
            data-number="0"
            style="
                display: inline-flex;
                width: 20px;
                height: 20px;
                background: black;
                padding: 10px;
                border-radius: 100px;
                margin-bottom: 5px;
                cursor: pointer;
            "
        >
            <svg
            style="
                filter: invert(1);
            "
            version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 585.913 585.913" style="enable-background:new 0 0 585.913 585.913;" xml:space="preserve">
                <g>
                    <path d="M11.173,46.2v492.311l346.22,47.402V535.33c0.776,0.058,1.542,0.109,2.329,0.109h177.39
                    c20.75,0,37.627-16.883,37.627-37.627V86.597c0-20.743-16.877-37.628-37.627-37.628h-177.39c-0.781,0-1.553,0.077-2.329,0.124V0
                    L11.173,46.2z M110.382,345.888l-1.37-38.273c-0.416-11.998-0.822-26.514-0.822-41.023l-0.415,0.01
                    c-2.867,12.767-6.678,26.956-10.187,38.567l-10.961,38.211l-15.567-0.582l-9.239-37.598c-2.801-11.269-5.709-24.905-7.725-37.361
                    l-0.25,0.005c-0.503,12.914-0.879,27.657-1.503,39.552L50.84,343.6l-17.385-0.672l5.252-94.208l25.415-0.996l8.499,32.064
                    c2.724,11.224,5.467,23.364,7.428,34.819h0.389c2.503-11.291,5.535-24.221,8.454-35.168l9.643-33.042l27.436-1.071l5.237,101.377
                    L110.382,345.888z M172.479,349.999c-12.569-0.504-23.013-4.272-28.539-8.142l4.504-17.249c3.939,2.226,13.1,6.445,22.373,6.687
                    c12.009,0.32,18.174-5.497,18.174-13.218c0-10.068-9.838-14.683-19.979-14.74l-9.253-0.052v-16.777l8.801-0.066
                    c7.708-0.208,17.646-3.262,17.646-11.905c0-6.121-4.914-10.562-14.635-10.331c-7.95,0.189-16.245,3.914-20.213,6.446l-4.52-16.693
                    c5.693-4.008,17.224-8.11,29.883-8.588c21.457-0.795,33.643,10.407,33.643,24.625c0,11.029-6.197,19.691-18.738,24.161v0.314
                    c12.229,2.216,22.266,11.663,22.266,25.281C213.89,338.188,197.866,351.001,172.479,349.999z M331.104,302.986
                    c0,36.126-19.55,52.541-51.193,51.286c-29.318-1.166-46.019-17.103-46.019-52.044v-61.104l25.711-1.006v64.201
                    c0,19.191,7.562,29.146,21.179,29.502c14.234,0.368,22.189-8.976,22.189-29.26v-66.125l28.122-1.097v65.647H331.104z
                    M359.723,70.476h177.39c8.893,0,16.125,7.236,16.125,16.126v411.22c0,8.888-7.232,16.127-16.125,16.127h-177.39
                    c-0.792,0-1.563-0.116-2.329-0.232V380.782c17.685,14.961,40.504,24.032,65.434,24.032c56.037,0,101.607-45.576,101.607-101.599
                    c0-56.029-45.581-101.603-101.607-101.603c-24.93,0-47.749,9.069-65.434,24.035V70.728
                    C358.159,70.599,358.926,70.476,359.723,70.476z M390.873,364.519V245.241c0-1.07,0.615-2.071,1.586-2.521
                    c0.981-0.483,2.13-0.365,2.981,0.307l93.393,59.623c0.666,0.556,1.065,1.376,1.065,2.215c0,0.841-0.399,1.67-1.065,2.215
                    l-93.397,59.628c-0.509,0.4-1.114,0.61-1.743,0.61l-1.233-0.289C391.488,366.588,390.873,365.585,390.873,364.519z" />
                </g>
            </svg>
        </span>
    `;

    wrapper.appendChild(bar);

    // 样式 / styles
    const style = document.createElement("style");

    style.innerHTML = `
        .number-indicator{
            position:relative;
        }

        .number-indicator::after{
            content: attr(data-number);
            position: absolute;
            bottom: 0;
            right: 0;
            color: #40a9ff;
            font-size: 14px;
            font-weight: bold;
            background: #000;
            border-radius: 10px;
            padding: 3px 5px;
        }

        .copy-link:link{
            text-decoration: none;
        }

        .copy-link:hover{
            text-decoration: underline;
        }

        .download-btn:hover{
            text-decoration: underline;
        }
        .download-btn:active{
            opacity: 0.9;
        }

        .mpv-btn{
            margin-left: 10px;
            color: #40a9ff;
            font-weight: bold;
            text-decoration: none;
            cursor: pointer;
            flex-shrink: 0;
        }
        .mpv-btn:hover{
            text-decoration: underline;
        }
        .mpv-btn:active{
            opacity: 0.9;
        }

        .m3u8-item{
            color: white;
            margin-bottom: 5px;
            display: flex;
            flex-direction: row;
            align-items: baseline;
            background: black;
            padding: 3px 10px;
            border-radius: 3px;
            font-size: 12px;
            user-select: none;
        }

        [data-shown="false"] {
            opacity: 0.8;
            zoom: 0.8;
        }

        [data-shown="false"]:hover{
            opacity: 1;
        }

        [data-shown="false"] .m3u8-item{
            display: none;
        }

    `;

    wrapper.appendChild(style);




    const barBtn = bar.querySelector(".number-indicator");

    // 关于显隐和移动 / visibility and dragging

    (async function () {

        let shown = await mgmapi.getValue("shown", true);
        wrapper.setAttribute("data-shown", shown);


        let x = await mgmapi.getValue("x", 10);
        let y = await mgmapi.getValue("y", 10);

        x = Math.min(innerWidth - 50, x);
        y = Math.min(innerHeight - 50, y);

        if (x < 0) x = 0;
        if (y < 0) y = 0;

        rootDiv.style.top = `${y}px`;
        rootDiv.style.right = `${x}px`;

        barBtn.addEventListener("mousedown", e => {
            let startX = e.pageX;
            let startY = e.pageY;

            let moved = false;

            let mousemove = e => {
                let offsetX = e.pageX - startX;
                let offsetY = e.pageY - startY;
                if (moved || (Math.abs(offsetX) + Math.abs(offsetY)) > 5) {
                    moved = true;
                    rootDiv.style.top = `${y + offsetY}px`;
                    rootDiv.style.right = `${x - offsetX}px`;
                }
            };
            let mouseup = e => {

                let offsetX = e.pageX - startX;
                let offsetY = e.pageY - startY;

                if (moved) {
                    x -= offsetX;
                    y += offsetY;
                    mgmapi.setValue("x", x);
                    mgmapi.setValue("y", y);
                } else {
                    shown = !shown;
                    mgmapi.setValue("shown", shown);
                    wrapper.setAttribute("data-shown", shown);
                }

                removeEventListener("mousemove", mousemove);
                removeEventListener("mouseup", mouseup);
            }
            addEventListener("mousemove", mousemove);
            addEventListener("mouseup", mouseup);
        });

    })();






    {
        // 请求检测 / request detection
        // Overriding fetch outright is risky and slow, so it is limited to socolive.
        if (location.href.includes("socolive")) {
            const _socoFetch = unsafeWindow.fetch;
            unsafeWindow.fetch = new Proxy(_socoFetch, {
                apply: function (target, thisArg, args) {
                    try {
                        const url = typeof args[0] === "string" ? args[0] : (args[0] && args[0].url);
                        if (url && url.includes(".flv")) doStream({ url, kind: "flv" });
                    } catch {
                        // Detection must never break the page's own fetch.
                    }
                    return Reflect.apply(target, thisArg, args);
                }
            });
        }

        const _r_text = unsafeWindow.Response.prototype.text;
        unsafeWindow.Response.prototype.text = function () {
            return new Promise((resolve, reject) => {
                _r_text.call(this).then((text) => {
                    resolve(text);
                    try {
                        const kind = sniffContent(text);
                        if (kind) doStream({ url: this.url, content: text, kind });
                        else if (sniffUrl(this.url)) doStream({ url: this.url });
                    } catch {
                        // Never surface detection errors to the page.
                    }
                }).catch(reject);
            });
        }

        const _open = unsafeWindow.XMLHttpRequest.prototype.open;
        unsafeWindow.XMLHttpRequest.prototype.open = function (...args) {
            const requestUrl = args[1];
            this.addEventListener("load", () => {
                try {
                    // responseText only exists for the default and "text" response types.
                    if (this.responseType && this.responseType !== "text") return;
                    const content = this.responseText;
                    const kind = sniffContent(content);
                    if (kind) doStream({ url: requestUrl, content, kind });
                } catch { }
            });
            try {
                if (sniffUrl(requestUrl)) doStream({ url: requestUrl });
            } catch {
                // A throw here would break the page's XMLHttpRequest.
            }
            return _open.apply(this, args);
        }


        // MSE 检测 / Media Source detection.
        // Segments the player appends by hand never pass through a url the panel
        // can see, so the MediaSource itself is what has to be watched.
        const mediaSourceCtors = [unsafeWindow.MediaSource, unsafeWindow.ManagedMediaSource]
            .filter(ctor => typeof ctor === "function" && ctor.prototype);

        for (const Ctor of mediaSourceCtors) {
            const _addSourceBuffer = Ctor.prototype.addSourceBuffer;
            if (typeof _addSourceBuffer !== "function") continue;
            Ctor.prototype.addSourceBuffer = function (mime) {
                try {
                    let codecs = mseCodecs.get(this);
                    if (!codecs) mseCodecs.set(this, codecs = new Set());
                    if (typeof mime === "string" && mime) codecs.add(mime);
                } catch {
                    // Detection must never break the page's own player.
                }
                return _addSourceBuffer.apply(this, arguments);
            };
        }

        // Pages mint object urls for images and downloads too, so only the ones
        // wrapping a MediaSource are recorded.
        if (mediaSourceCtors.length && unsafeWindow.URL && typeof unsafeWindow.URL.createObjectURL === "function") {
            const _createObjectURL = unsafeWindow.URL.createObjectURL;
            unsafeWindow.URL.createObjectURL = function (obj) {
                const objectUrl = _createObjectURL.apply(this, arguments);
                try {
                    if (mediaSourceCtors.some(Ctor => obj instanceof Ctor)) {
                        mseObjectUrls.set(objectUrl, new WeakRef(obj));
                    }
                } catch {
                    // Never let bookkeeping fail the page's createObjectURL call.
                }
                return objectUrl;
            };

            const _revokeObjectURL = unsafeWindow.URL.revokeObjectURL;
            if (typeof _revokeObjectURL === "function") {
                unsafeWindow.URL.revokeObjectURL = function (objectUrl) {
                    try {
                        mseObjectUrls.delete(objectUrl);
                    } catch { }
                    return _revokeObjectURL.apply(this, arguments);
                };
            }
        }


        // 检查纯视频 / watch for plain <video> elements
        watchMedia();

    }

    // Videos used to be found by re-querying the whole document every second,
    // which costs the same on a page that never gains a video as on one that
    // does. Two signals replace the poll and between them cover everything it
    // saw: the media events themselves, which is when a duration actually becomes
    // readable, and a mutation observer for elements added or re-pointed without
    // any event of their own.
    function watchMedia() {
        for (const name of ["loadedmetadata", "durationchange", "loadeddata", "canplay", "playing"]) {
            // Media events do not bubble, but a capture-phase listener on the
            // document still sees every one of them on the way down.
            document.addEventListener(name, (e) => {
                try {
                    scanForVideos(e.target);
                } catch { }
            }, true);
        }

        const observer = new MutationObserver((records) => {
            for (const record of records) {
                try {
                    if (record.type === "attributes") scanForVideos(record.target);
                    else for (const node of record.addedNodes) scanForVideos(node);
                } catch { }
            }
        });

        (function observeRoot() {
            // At document-start there may be no documentElement to observe yet.
            if (!document.documentElement) return void setTimeout(observeRoot, 0);
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
                attributes: true,
                // A player swapping streams writes src rather than replacing the
                // element, and `v.src = url` reflects to the attribute.
                attributeFilter: ["src"]
            });
            scanForVideos(document.documentElement);
        })();
    }

    function scanForVideos(node) {
        if (!node || node.nodeType !== 1) return;
        if (node.tagName === "VIDEO") checkVideo(node);
        // <source> carries the url for videos that have no src of their own.
        else if (node.tagName === "SOURCE" && node.parentElement && node.parentElement.tagName === "VIDEO") {
            checkVideo(node.parentElement);
        }
        if (node.querySelectorAll) {
            for (const v of node.querySelectorAll("video")) checkVideo(v);
        }
    }

    function checkVideo(v) {
        // currentSrc also covers <source> children, which v.src misses.
        const src = v.currentSrc || v.src;
        if (!src || shownUrls.has(src)) return;

        if (src.startsWith("blob:")) return checkMediaSource(v, src);
        if (!src.startsWith("http")) return;
        // No duration yet means metadata is still loading; the event that
        // delivers it will bring us back here.
        if (!v.duration) return;

        let url;
        try {
            url = new URL(src);
        } catch {
            return;
        }

        listIframeOnce();
        showVideo({
            type: "video",
            url,
            duration: formatDuration(v.duration),
            download() {
                mgmapi.download({
                    url: src,
                    name: buildFileName(src),
                    headers: {
                        // referer: location.origin, // 不允许该头
                        origin: location.origin
                    },
                    onerror(e) {
                        mgmapi.openInTab(src);
                    }
                });
            }
        });
    }

    // A blob url on a <video> is worth a row only when it stands for a
    // MediaSource: an ordinary blob video is a file the page already holds, while
    // an MSE stream is one being assembled from segments fetched elsewhere. The
    // row exists to say so — neither MPV nor the downloader can open a blob url,
    // so the stream itself has to be picked up from an m3u8 or mpd row.
    function checkMediaSource(v, blobUrl) {
        const ref = mseObjectUrls.get(blobUrl);
        const mediaSource = ref && ref.deref();
        if (!mediaSource) return;

        const codecs = mseCodecs.get(mediaSource);
        // addSourceBuffer has not run yet; a later media event will find it.
        if (!codecs || !codecs.size) return;

        let url;
        try {
            url = new URL(blobUrl);
        } catch {
            return;
        }

        listIframeOnce();
        showVideo({
            type: "mse",
            url,
            label: [...codecs].join(", "),
            title: `${blobUrl}\nMedia Source stream — segments are fetched separately, look for an m3u8 or mpd row`,
            duration: formatDuration(v.duration)
        });
    }

    function buildFileName(src) {
        let name = "";
        try {
            name = new URL(src).pathname.split("/").pop() || "";
        } catch { }
        if (!/\.\w+$/.test(name)) {
            if (name.match(/^\s*$/)) name = String(Date.now());
            name = name + ".mp4";
        }
        return name;
    }

    async function doStream({ url, content, kind }) {

        let parsed;
        try {
            parsed = new URL(url, location.href);
        } catch {
            return;
        }

        if (shownUrls.has(parsed.href)) return;
        // Claim the url before awaiting anything: the fetch below re-enters this
        // function through the patched Response.prototype.text.
        shownUrls.set(parsed.href, true);

        try {
            // An flv url is listed on its own; there is no manifest to read.
            if (kind !== "flv" && content === undefined) {
                content = await (await fetch(parsed.href)).text();
            }
            // The body decides, since a manifest is often served from a url that
            // names no extension at all.
            if (!kind) kind = sniffContent(content) || sniffUrl(parsed.href) || "m3u8";

            let duration = "未知(unknown)";
            if (kind === "m3u8") {
                // 解析 m3u / parse the playlist
                duration = describeHls(content, parsed.href);
            } else if (kind === "mpd") {
                duration = describeDash(content);
                // Not a manifest after all — drop it rather than list a bad row.
                if (!duration) {
                    shownUrls.delete(parsed.href);
                    return;
                }
            }

            listIframeOnce();
            showVideo({
                type: kind,
                url: parsed,
                duration,
                // The thatwind downloader speaks HLS, so a DASH manifest gets no
                // download button rather than one that opens a tool that will
                // fail on it. MPV plays either.
                download: kind === "mpd" ? null : async function () {
                    mgmapi.openInTab(downloaderUrl(parsed.href, await getTopTitle()));
                }
            })
        } catch {
            // Release the url so a later detection of the same stream can retry.
            shownUrls.delete(parsed.href);
        }

    }



    function showVideo({
        type,
        url,
        duration,
        download,
        label,
        title
    }) {
        // The rendered rows are the authority on what has already been listed, so
        // an entry aged out of shownUrls can never produce a second row.
        for (const row of wrapper.querySelectorAll(".m3u8-item")) {
            if (row.dataset.url === url.href) return;
        }

        const div = document.createElement("div");
        div.className = "m3u8-item";
        div.dataset.url = url.href;

        const typeLabel = document.createElement("span");
        typeLabel.textContent = type;

        // Built node by node rather than through innerHTML: url and type come from
        // whatever the page requested.
        const link = document.createElement("a");
        link.className = "copy-link";
        link.href = url.href;
        link.title = title || url.href;
        link.target = "_blank";
        link.rel = "noreferrer noopener";
        link.textContent = label || (url.pathname + url.search);
        link.style.cssText = `
            color: white;
            max-width: 200px;
            text-overflow: ellipsis;
            white-space: nowrap;
            overflow: hidden;
            margin-left: 10px;
            cursor: pointer;
        `;

        const durationLabel = document.createElement("span");
        durationLabel.textContent = duration;
        durationLabel.style.cssText = `
            margin-left: 10px;
            flex-grow: 1;
        `;

        div.append(typeLabel, link, durationLabel);

        // A real anchor rather than a click handler: the browser hands mpv:// to the
        // protocol handler itself, and the url stays visible and copyable. A blob
        // url is the one thing MPV cannot be handed, so an MSE row carries no
        // button rather than one that opens an empty player.
        if (url.protocol === "http:" || url.protocol === "https:") {
            const mpvBtn = document.createElement("a");
            mpvBtn.className = "mpv-btn";
            mpvBtn.href = mpvUrl(url.href);
            mpvBtn.textContent = "MPV";
            mpvBtn.title = "Play in MPV (sends the page as Referer)";
            div.append(mpvBtn);
        }

        if (download) {
            const downloadBtn = document.createElement("span");
            downloadBtn.className = "download-btn";
            downloadBtn.textContent = "⯆";
            downloadBtn.title = "Download";
            downloadBtn.style.cssText = `
                margin-left: 10px;
                cursor: pointer;
            `;
            downloadBtn.addEventListener("click", download);
            div.append(downloadBtn);
        }

        link.addEventListener("click", async (e) => {
            // Plain click copies; ctrl/middle click still opens the link.
            if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            // 复制链接
            await mgmapi.copyText(url.href);
            mgmapi.message("已复制链接 (link copied)", 2000);
        });

        rootDiv.style.display = "block";

        count++;

        shownUrls.set(url.href, true);

        bar.querySelector(".number-indicator").setAttribute("data-number", count);

        wrapper.appendChild(div);
    }

})();
