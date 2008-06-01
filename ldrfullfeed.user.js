// ==UserScript==
// @name        LDR Full Feed
// @namespace   http://d.hatena.ne.jp/Constellation/
// @include     http://reader.livedoor.com/reader/*
// @include     http://fastladder.com/reader/*
// @description loading full entry on LDR and Fastladder
// @version     0.0.16
// @author      Constellation
// ==/UserScript==

(function(w){

// == [CSS] =========================================================
const CSS = <><![CDATA[
.gm_fullfeed_loading, .gm_fullfeed_loading a{color : green !important;}
.gm_fullfeed_loading .item_body a{color : palegreen !important;}
.gm_fullfeed_loading{background-color : Honeydew !important;}
.gm_fullfeed_icon{cursor : pointer ;}
]]></>.toString();

// == [Icon] ========================================================
const ICON = <><![CDATA[
data:image/gif;base64,
R0lGODdhEwATAPMAMf+MAP+lAP+lOv+0AP+0kP/EAP/Etv/TOv/hZv/x2//x////tv//2////wAA
AAAAACwAAAAAEwATAAAETBDISWsNOOuNJf+aB4LiyJUZ0awNsqGB0RSYkAwhoAnKYaIEBm4EXJgC
QGFA1VBmUDwfJjjs6DQy2tJp5TBX0uf1mCO/xmYk2mxptyMAOw==
]]></>.toString().replace(/\s+/g, '');

const ICON2 = <><![CDATA[
data:image/gif;base64,
R0lGODdhEwATAPQAMUFp4YfO64fO7ofW9Yfe+LHO68XW68X3/MX3/9ne6+zn7uz/+Oz//Oz////v
8v///P///wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACwAAAAA
EwATAAAFUCAgjmRZBmiqrqjIvqoLw/LM1unQQLyz4gECJIESHAwxgEqAUNhwAwZyBl0UnsqcNKCD
PKatbLGpBQeAQiJ3mwJydzxn0vZy0+1Y+s3EN4UAADs=
]]></>.toString().replace(/\s+/g, '');

// == [Config] ======================================================

const VERSION = '0.0.16'

const KEY = 'g';
const GET_SITEINFO_KEY = 'G';
const GET_ALL = true;
const GET_ALL_KEY = 'u';

const ADCHECKER = /(^AD:|^PR:)/;
const LOADING_MOTION = true;

const REMOVE_SCRIPT = true;
const REMOVE_H2TAG = true;
const REMOVE_IFRAME = true;

const OPEN = false; //SITEINFOになかった場合にそのエントリを開くかどうか
const ITEMFILTER = true;
const AUTO_SEARCH = true;
const EXTRACT_TEXT = false;
const WIDGET = true;
const CLICKABLE = true; 

const DEBUG = false;

const SITEINFO_IMPORT_URLS = [
{
  name:'WeData',
  format:'JSON',
  url: 'http://wedata.net/databases/LDRFullFeed/items.json'
},
{
  name:'Microformats URL List',
  format:'HTML',
  url: 'http://constellation.jottit.com/microformats_url_list'
},

//{format:'HTML', url: 'http://constellation.jottit.com/siteinfo'},
//{format:'HTML', url: 'http://constellation.jottit.com/test'},
];

// == [SITE_INFO] ===================================================

const SITE_INFO = [
];

const MICROFORMATS = [
  {
      name : 'hAtom-Content',
      xpath: '//*[contains(concat(" ",normalize-space(@class)," "), " hentry ")]//*[contains(concat(" ",normalize-space(@class)," "), " entry-content ")]',
  },
  {
      name : 'hAtom',
      xpath: '//*[contains(concat(" ",normalize-space(@class)," "), " hentry ")]',
  },
  {
      name : 'xFolk',
      xpath: '//*[contains(concat(" ",@class," "), " xfolkentry ")]//*[contains(concat(" ",normalize-space(@class)," "), " description ")]',
  },
  {
      name : 'AutoPagerize(Microformats)',
      xpath: '//*[contains(concat(" ",normalize-space(@class)," "), " autopagerize_page_element ")]',
  },
]

// == [Cache Phase] =================================================

const PHASE = [
  {type:'SBM'                            },
  {type:'INDIVIDUAL',         sub:'IND'  },
  {type:'INDIV_MICROFORMATS'             },
  {type:'SUBGENERAL',         sub:'SUB'  },
  {type:'GENERAL',            sub:'GEN'  },
  {type:'MICROFORMATS',       sub:'MIC'  }
];


// == [Application] =================================================

// [FullFeed]
var FullFeed = function(info, c){
  if(DEBUG) log(info, c)
  this.itemInfo = c;
  this.info = info;

  this.requestURL = this.itemInfo.itemURL;
  var bodyXPath = 'id("item_body_' + this.itemInfo.id + '")/div[@class="body"]';
  this.itemInfo.item_body = $X(bodyXPath, document)[0];
  this.state = 'wait';
  this.mime = 'text/html; charset=' + (this.info.enc || document.characterSet);
  this.entry = [];


  this.request();
};

FullFeed.prototype.request = function(){
  if (!this.requestURL) {
    return
  }
  this.state = 'request';
  var self = this;
  var opt = {
        method: 'get',
        url: this.requestURL,
        overrideMimeType: this.mime,
        headers: {
          'User-Agent': navigator.userAgent + ' Greasemonkey (LDR Full Feed ' + VERSION + ')',
        },
        onerror: function(){
          self.error.apply(self, ['FullFeed Request Error']);
        },
        onload: function(res){
          self.requestLoad.apply(self, [res])
        },
  };
  message('Loading Full Feed...');
  w.toggleClass(this.itemInfo.item_container, 'gm_fullfeed_loading');
  if (this.info.base && opt.url.indexOf('http:') != 0) {
    opt.url = pathToURL(this.info.base, opt.url);
  }
  window.setTimeout(GM_xmlhttpRequest, 0, opt);
}

FullFeed.prototype.requestLoad = function(res) {
  this.state = 'loading';
  var text = res.responseText;
  var self = this;
  
  text = text.replace(/(<[^>]+?[\s"'])on(?:(?:un)?load|(?:dbl)?click|mouse(?:down|up|over|move|out)|key(?:press|down|up)|focus|blur|submit|reset|select|change)\s*=\s*(?:"(?:\\"|[^"])*"?|'(\\'|[^'])*'?|[^\s>]+(?=[\s>]|<\w))(?=[^>]*?>|<\w|\s*$)/gi,
    "$1");

  if (REMOVE_IFRAME)  text = text.replace(/<iframe(?:\s[^>]+?)?>[\S\s]*?<\/iframe\s*>/gi, "");

  try{
    var htmldoc = parseHTML(text);
  } catch(e) {
    return this.error('HTML Parse Error');
  }

  removeXSSRisk(htmldoc);

  if(this.info.base && !this.requestURL.indexOf(this.info.base) == 0){
     relativeToAbsolutePath(htmldoc, this.info.base);
  } else {
     relativeToAbsolutePath(htmldoc, this.requestURL);
  }

  if(DEBUG) time('FULLFEED: DocumentFilterTime: ')
  FullFeed.documentFilters.forEach(function(f) {
      f(htmldoc, self.requestURL, self.info);
  });
  if(DEBUG) timeEnd('FULLFEED: DocumentFilterTime: ')

  if(this.info.microformats){
    if(DEBUG) log('FULLFEED: Microformats')
    this.entry = getElementsByMicroformats(htmldoc)
  }

  if(this.entry.length == 0){
    try{
      this.entry = $X(this.info.xpath, htmldoc, Array);
    } catch(e) {
      return this.error('Something is wrong with this XPath');
    }
  }

  if(AUTO_SEARCH && this.entry.length == 0){
    if(DEBUG) log('FULLFEED: Auto Search');
    this.entry = searchEntry(htmldoc);
  }

  if(EXTRACT_TEXT && this.entry.length == 0){
    if(DEBUG) log('FULLFEED: Extract Text');
    this.entry = extractText(htmldoc);
  }

  if (this.entry.length > 0) {
    this.removeEntry();
    if(DEBUG) time('FULLFEED: FilterTime: ')
    FullFeed.filters.forEach(function(f) { f(self.entry, self.requestURL) });
    if(DEBUG) timeEnd('FULLFEED: FilterTime: ')

    this.addEntry();

    this.requestEnd();
  } else {
    return this.error('This SITE_INFO is unmatched to this entry');
  }
}

FullFeed.prototype.requestEnd = function(){
  this.state = 'loaded';
  message('Loading Full Feed... Done');
  w.addClass(this.itemInfo.item_container, 'gm_fullfeed_loaded');
  w.toggleClass(this.itemInfo.item_container, 'gm_fullfeed_loading');
  if (this.info.base) {
    w.addClass(this.itemInfo.item_container, this.info.base);
  } else {
    w.addClass(this.itemInfo.item_container, this.requestURL);
  }
}

FullFeed.prototype.error = function(e){
  this.state = 'error';
  message('Error: ' + e);
  w.addClass(this.itemInfo.item_container, 'gm_fullfeed_error');
  w.toggleClass(this.itemInfo.item_container, 'gm_fullfeed_loading');
}

FullFeed.prototype.removeEntry = function(){
  while (this.itemInfo.item_body.firstChild) {
    this.itemInfo.item_body.removeChild(this.itemInfo.item_body.firstChild);
  }
}

FullFeed.prototype.addEntry = function(){
  var self = this;
  this.entry = this.entry.map(function(i) {
      var pe = document.importNode(i,true);
      self.itemInfo.item_body.appendChild(pe);
      return pe;
  });
}

FullFeed.register = function(){

  if(!WIDGET) return;
  var description = "\u5168\u6587\u53d6\u5f97\u3067\u304d\u308b\u3088\uff01";
  w.entry_widgets.add('gm_fullfeed_widget', function(feed, item){
    if (cache.pattern.test(item.link) || cache.pattern.test(feed.channel.link)) {
      if(CLICKABLE) return [
        '<img class="gm_fullfeed_icon_disable" id="gm_fullfeed_widget_'+item.id+'" src="'+ICON+'">'
      ].join('');
      else return [
        '<img src="'+ICON+'">'
      ].join('');
    }
  }, description);

  if(!CLICKABLE) return;
  var tmp = [];
  w.register_hook("AFTER_PRINTFEED", function(feed){
    addListener();
    if(!w.State.writer || w.State.writer.complete){
      return;
    }
    watchWriter(feed);
  });

  w.register_hook("BEFORE_PRINTFEED", function(feed){
    removeListener();
  });

  function watchWriter(feed){
    w.State.writer.watch("complete", function(key, oldVal, newVal){
      w.State.writer2.watch("complete", function(key, oldVal, newVal){
        if(! w.State.writer.complete){
          watchWriter(feed);
          return newVal;
        }
        addListener();
        return newVal;
      });
      return newVal;
    })
  }

  function addListener(){
    $X('id("right_body")//img[contains(concat(" ",@class," ")," gm_fullfeed_icon_disable ")]', document)
    .forEach(function(element){
      w.removeClass(element, 'gm_fullfeed_icon_disable');
      w.addClass(element, 'gm_fullfeed_icon');
      element.addEventListener('click', getEntryByPressButton, true);
      tmp.push(element);
    });
  }

  function removeListener(){
    while(tmp.length){
      try{
        tmp.pop().removeEventListener('click', getEntryByPressButton, true);
      }catch(e){}
    }
  }

  function getEntryByPressButton (e){
    var re = /gm_fullfeed_widget_(\d+)/;
    var id = this.id.match(re)[1];
    if(this.className && this.className == 'gm_fullfeed_icon'){
      var item = id2item(id);
      if(item) init(item);
    }
  }

}


FullFeed.documentFilters = [];

FullFeed.filters= [];

FullFeed.itemFilters= [];

// API
window.FullFeed = {
  VERSION : VERSION,
  addItemFilter : function(f){ FullFeed.itemFilters.push(f); },
  addFilter : function(f){ FullFeed.filters.push(f); },
  addDocumentFilter : function(f){ FullFeed.documentFilters.push(f); },
};



// Filter: Add TargetAttr
window.FullFeed.addFilter(function(nodes, url){
    nodes.forEach(function(e){
      var anchors = $X('descendant-or-self::a', e);
      if(anchors)
        anchors.forEach(function(i){ i.target = '_blank' });
    });
});

// Filter: Remove Script and H2 tags
// iframeはどうも要素を作成した時点で読みにいくようなので、textから正規表現で削除
// なので、SITEINFOはIFRAMEを基準に作成しないでいただけるとありがたい。
if(REMOVE_SCRIPT || REMOVE_H2TAG || REMOVE_IFRAME)
window.FullFeed.addFilter(function(nodes, url){
  filter(nodes, function(e){
    var n = e.nodeName;
    if(REMOVE_SCRIPT && n.indexOf('SCRIPT') == 0) return false;
    if(REMOVE_H2TAG && n.indexOf('H2') == 0) return false;
    return true;
  });
  nodes.forEach(function(e){
    $X('descendant::*[self::script or self::h2]', e)
    .forEach(function(i){
      i.parentNode.removeChild(i);
    });
  });
});

// Filter: Remove Particular Class
// LDR 自体が使っているclassを取り除く。とりあえずmoreだけ。
// ほかにもあれば追加する。
window.FullFeed.addFilter(function(nodes, url){
  nodes.forEach(function(e){
    $X('descendant-or-self::*[contains(concat(" ",@class," ")," more ")]', e)
    .forEach(function(i){
      w.removeClass(i, 'more');
    });
  });
});


// [Cache Manage]

var Cache = function(){
  var self = this;
  this.pattern;
  this.state = 'normal';
  this.getSiteinfo();
  this.rebuildLocalSiteinfo();
  if(DEBUG) log(this.cacheInfo);
  if(WIDGET) this.createPattern();
  GM_registerMenuCommand('LDR Full Feed - reset cache', function(){ self.resetSiteinfo.apply(self, []); });
  if(this.state == 'first') this.resetSiteinfo();
}

Cache.prototype.rebuildLocalSiteinfo = function(){
  this.siteinfo = SITE_INFO
                  .map(function(i){
                      i.urlIndex = -1;
                      return i;
                  });
}

Cache.prototype.getSiteinfo = function (){
  if(!(this.cacheInfo = eval(GM_getValue('cache')))){
    if(DEBUG) log('CACHE: first');
    this.state = 'first';
    var t = {info:{}};
    PHASE.forEach(function(i){t.info[i.type] = []});
    this.cacheInfo = t;
  }
}

Cache.prototype.resetSiteinfo = function(){
  if(this.state == 'loading') return message('Now loading. Please wait!');
  this.state = 'loading';
  this.success = 0;
  message('Resetting cache. Please wait...');
  this.tmp = {};
  var self = this;
  PHASE.forEach(function(i){
      self.tmp[i.type] = [];
  });
  SITEINFO_IMPORT_URLS.forEach(function(obj, index) {
      var name = obj.name || obj.url;
      var opt = {
        method: 'GET',
        url: obj.url,
        headers: {
          'User-Agent': navigator.userAgent + ' Greasemonkey (LDR Full Feed ' + VERSION + ')',
        },
        onload: function(res){
          self.setSiteinfo.apply(self, [res, obj, index]);
        },
        onerror: function(res){
          self.error.apply(self, ['Cache Request Error'+name]);
        },
      }
      window.setTimeout(GM_xmlhttpRequest, 0, opt);
  });
}

Cache.prototype.setSiteinfo = function(res, obj, index){
  var self = this;
  var info = [];
  var data = {};
  var name = obj.name || obj.url;
  switch (obj.format.toUpperCase()){
    case 'JSON':
      try {
        info = eval(res.responseText)
          .map(function(i){
            var d = i.data;
            d.microformats = (d.microformats == 'true')? true: false;
            d.urlIndex = index;
            return d;
          })
          .filter(function(i){ return (Cache.isValid(i) && i.type)? true : false});
      } catch(e) {
        return this.error('Not JSON: '+name);
      }
      break;

    case 'HTML':
      try {
        var doc = parseHTML(res.responseText);
      } catch(e) {
        return this.error('HTML Parse Error: '+name);
      }

      $X('//textarea[contains(concat(" ",normalize-space(@class)," "), " ldrfullfeed_data ")]', doc)
      .forEach(function(siteinfo_list){
        var data = self.parseSiteinfo.apply(self, [siteinfo_list.value, index]);
        if (data)
          info.push(data);
      });

      var charsets = ['utf-8','euc-jp','shift_jis'];
      charsets.forEach(function(charset){
        $X('//ul[contains(concat(" ",normalize-space(@class)," "), " microformats_list ' + charset + ' ")]/li', doc)
        .forEach(function(microformats_data){
          var data = self.parseMicroformats.apply(self, [charset, microformats_data, index]);
          if(data)
            info.push(data);
        });
      });
      break;
  }
  PHASE.forEach(function(i){
      info.filter(function(d){ return (d.type.toUpperCase() == i.type
          || (i.sub && d.type.toUpperCase() == i.sub))? true : false })
          .forEach(function(d){ self.tmp[i.type].push(d) });
      self.tmp[i.type].sort(function(a,b){ return a.urlIndex - b.urlIndex});
      if(DEBUG) log('CACHE: ' + i.type + ':ok');
  });
  ++this.success
  if(DEBUG) log(name);
  if (this.tmp && this.success == SITEINFO_IMPORT_URLS.length ) {
    this.cacheInfo = {
      info: this.tmp,
    }
    GM_setValue('cache', this.cacheInfo.toSource());
    if(DEBUG) log(this.cacheInfo);
    if(WIDGET) this.createPattern();
    var name = obj.name || '';
    message('Resetting cache. Please wait... Done');
    this.state = 'normal';
  }
}

Cache.prototype.error = function(e){
  message('Error: '+e);
  this.state = 'normal';
}

Cache.prototype.parseMicroformats = function(c, li, index){
  if(!li) return;
  var info = {
    url : li.textContent,
    urlIndex : index,
    enc : c,
    microformats : true,
    type : 'INDIV_MICROFORMATS'
  }

  var isValidUrl = function(info){
    try {
      var reg = new RegExp(info.url);
    } catch(e) {
      return false;
    }
    return true;
  }

  return isValidUrl(info) ? info : null;
}

Cache.prototype.parseSiteinfo = function(text){
  var lines = text.split(/[\r\n]+/);
  var reg = /(^[^:]*?):(.*)$/;
  var trimspace = function(str){
    return str.replace(/^\s*/, '').replace(/\s*$/, '');
  }
  var info = {};
  lines.forEach(function(line) {
    if (reg.test(line)) {
      info[RegExp.$1] = trimspace(RegExp.$2);
    }
  });

  info.microformats = (info.microformats && info.microformats == 'true')? true: false;

  return Cache.isValid(info) ? info : null;
}

Cache.prototype.createPattern = function(){
  var exps = [];
  var reg;

  this.siteinfo.forEach(function(i){
    exps.push(i.url);
  });

  for each (var i in this.cacheInfo.info) {
    i.forEach(function(info) {
      exps.push(info.url);
    });
  }

  reg = new RegExp (exps.join('|'));
  this.pattern = reg;
}

Cache.isValid = function(info) {
  var infoProp = ['url', 'xpath', 'type'];
  if (infoProp.some(function(i){
    if (!info[i]){
      if (i != 'xpath' || !info.microformats){
        return true;
      }
    }
  })) return false;

  try{
    new RegExp(info.url);
  } catch(e) {
    return false;
  }
  return true;
}

// [Register LDR]

var getItem = function(item){
  if(item){
    this.item = item;
  } else {
    this.item = w.get_active_item(true);
  }
  if(!this.item) return;
  this.feed = w.get_active_feed();
  this.itemURL = this.item.link;
  this.feedURL = this.feed.channel.link;
  this.id = this.item.id;
  this.item_container = w.$('item_' + this.id);
  this.title = this.item.title;
  this.found = false;
  
};

var launchFullFeed = function(list, c) {
  if (typeof list.some != "function") return;
    list.some(function(i) {
      var reg = new RegExp(i.url);
      if (reg.test(c.itemURL) || reg.test(c.feedURL)) {
        c.found = true;
        var ff = new FullFeed(i, c);
        return true;
      } else {
        return false;
      }
    });
}

var loadCurrentEntry = function(){
  init();
};

var loadAllEntries = function(){
  var entries = w.get_active_feed().items;
  if (entries && entries.length > 0)
  entries.forEach(function(i){ init(i)});
};

var init = function(i){
  var c = (i) ? new getItem(i) : new getItem();
  if(!c.item) return;

  if(ITEMFILTER){
    FullFeed.itemFilters.forEach(function(f) {
      f(c);
    });
  }

  if(ADCHECKER.test(c.title))
    return message('This entry is advertisement');
  if(w.hasClass(c.item_container, 'gm_fullfeed_loaded'))
    return message('This entry has been already loaded.');
  if(w.hasClass(c.item_container, 'gm_fullfeed_loading'))
    return message('Now loadig...');


  launchFullFeed(cache.siteinfo, c);
  if(DEBUG) log('PHASE: LOCAL SITEINFO');

  if(!c.found && !PHASE.some(function(i){
      if(DEBUG) log('PHASE: ' + i.type);
      launchFullFeed(cache.cacheInfo.info[i.type], c);
      if(c.found) {
        return true;
      }
  })){
    message('This entry is not listed on SITE_INFO');
    if (OPEN) window.open(c.itemURL) || message('Cannot popup');
  }
};

var cache = new Cache();

if(LOADING_MOTION) addStyle(CSS, 'gm_fullfeed_style');

var timer = setTimeout(function() {
  if (timer) clearTimeout(timer);
  if (typeof w.Keybind != 'undefined' && typeof w.entry_widgets != 'undefined') {
    w.Keybind.add(KEY, function(){
      loadCurrentEntry();
    });

    if(GET_ALL){
    w.Keybind.add(GET_ALL_KEY, function(){
      loadAllEntries();
    });
    }

    w.Keybind.add(GET_SITEINFO_KEY, function() {
      cache.resetSiteinfo();
    });

    if(WIDGET) FullFeed.register();
  } else {
    timer = setTimeout(arguments.callee, 100);
  }
});

// == [Utility Functions] ===========================================

function message (mes){
  w.message(mes);
}

function id2item (id){
  var t;
  var items = w.get_active_feed().items;
  if(items.some(function(item){
    if(id == item.id){
      t = item;
      return true;
    }
  })) return t;
  else return null;
}

function getElementsByMicroformats (htmldoc) {
  var t;
  MICROFORMATS.some(function(i){
    t = $X(i.xpath, htmldoc)
    if(t.length>0){
      if(DEBUG) log('FULLFEED: Microformats :' + i.name);
      return true;
    }
    else return false;
  });
  return t;
}

function removeXSSRisk (htmldoc){
  var attr = "allowscriptaccess";
    $X("descendant-or-self::embed", htmldoc)
      .forEach(function(elm){
      if(!elm.hasAttribute(attr)) return;
      elm.setAttribute(attr, "never");
    });
    $X("descendant-or-self::param", htmldoc)
      .forEach(function(elm){
      if(!elm.getAttribute("name") || elm.getAttribute("name").toLowerCase().indexOf(attr) < 0) return;
      elm.setAttribute("value", "never");
    });
}

function extractText (htmldoc) {
  var div = document.createElement('div');
  $X('(descendant-or-self::text()[../self::*[self::div or self::table or self::td or self::th or self::tr or self::dt or self::dd or self::font or self::strong or self::ul or self::li]]|descendant-or-self::img|descendant-or-self::a)', htmldoc)
    .map(function(i){
      log(i.parentNode.nodeName);
      if(i.nodeName == 'IMG')
        return i;
      else if(i.nodeName == 'A')
        return i;
      else{
        i.nodeValue = i.nodeValue+'\n'
        return i;
      }
    })
    .forEach(function(i){
      div.appendChild(i);
    });
  div.innerHTML = div.innerHTML
    .replace(/(?:(\r\n|\r|\n)\s*)+/g,'<br>$1');
  return [div];
}

function searchEntry(htmldoc) {
  var max = 0;
  var entry = [];
  var data;
  var xpath = [
      '(//div|//td|//table|//tbody)',
      '[(..//h2) or (.//h3) or (.//h4) or (.//h5) or (.//h6) or (..//*[contains(concat(@id,@class,""),"title")])]',
      // '[(.|.//*|ancestor-or-self::*)contains(concat(@id,@class,""),"entry")) or (contains(concat(@id,@class,""),"section")) or (contains(concat(@id,@class,""),"content")) or (contains(concat(@id,@class,""),"main")) or (contains(concat(@id,@class,""),"day")) or (contains(concat(@id,@class,""),"article"))]]',
      '[not(.//form|ancestor-or-self::form)]',
      '[not((.|.//*|ancestor-or-self::*)contains(concat(" ",@class," ")," robots-nocontent ")])]',
      '[not((.|.//*|ancestor-or-self::*)starts-with(concat(@id,@class,""),"side")])]',
      '[not((.|.//*|ancestor-or-self::*)starts-with(concat(@id,@class,""),"navi")])]',
      '[not((.|.//*|ancestor-or-self::*)starts-with(concat(@id,@class,""),"footer")])]',
      '[not((.|.//*|ancestor-or-self::*)starts-with(concat(@id,@class,""),"header")])]',
      '[not(.//script|ancestor-or-self::script)]',
].join('');
  try {
    var elms = $X(xpath, htmldoc);
    if(elms.length == 0) return entry;
    elms.forEach(function(e){
      // var n = e.getElementsByTagName('br').length;
      var n = e.textContent.length;
      if(max < n){
        max = n;
        data = e;
      }
    });
    entry.push(data);
    return entry;
  }catch (e){
    return [];
  }
}

// written by id:Yuichirou
function relativeToAbsolutePath(htmldoc, base) {
  var top = base.match("^https?://[^/]+")[0];
  var current = base.replace(/\/[^/]+$/, '/');

  $X("descendant-or-self::a", htmldoc)
    .forEach(function(elm) {
    if(elm.getAttribute("href")) elm.href = _rel2abs(elm.getAttribute("href"), top, current);
  });
  $X("descendant-or-self::img", htmldoc)
    .forEach(function(elm) {
    if(elm.getAttribute("src")) elm.src = _rel2abs(elm.getAttribute("src"), top, current);
  });
  $X("descendant-or-self::embed", htmldoc)
    .forEach(function(elm) {
    if(elm.getAttribute("src")) elm.src = _rel2abs(elm.getAttribute("src"), top, current);
  });
  $X("descendant-or-self::object", htmldoc)
    .forEach(function(elm) {
    if(elm.getAttribute("data")) elm.data = _rel2abs(elm.getAttribute("data"), top, current);
  });
}

function _rel2abs(url, top, current) {
  if (url.match("^https?://")) {
    return url;
  } else if (url.indexOf("/") == 0) {
    return top + url;
  } else {
    return current + url;
  }
}

// $X (c) id:cho45
// $X(exp);
// $X(exp, context);
// $X(exp, type);
// $X(exp, context, type);
function $X (exp, context, type /* want type */) {
    if (typeof context == "function") {
        type    = context;
        context = null;
    }
    if (!context) context = document;
    var exp = (context.ownerDocument || context).createExpression(exp, function (prefix) {
        var o = document.createNSResolver(context).lookupNamespaceURI(prefix);
        if (o) return o;
        return (document.contentType == "application/xhtml+xml") ? "http://www.w3.org/1999/xhtml" : "";
    });

    switch (type) {
        case String:
            return exp.evaluate(
                context,
                XPathResult.STRING_TYPE,
                null
            ).stringValue;
        case Number:
            return exp.evaluate(
                context,
                XPathResult.NUMBER_TYPE,
                null
            ).numberValue;
        case Boolean:
            return exp.evaluate(
                context,
                XPathResult.BOOLEAN_TYPE,
                null
            ).booleanValue;
        case Array:
            var result = exp.evaluate(
                context,
                XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                null
            );
            var ret = [];
            for (var i = 0, len = result.snapshotLength; i < len; i++) {
                ret.push(result.snapshotItem(i));
            }
            return ret;
        case undefined:
            var result = exp.evaluate(context, XPathResult.ANY_TYPE, null);
            switch (result.resultType) {
                case XPathResult.STRING_TYPE : return result.stringValue;
                case XPathResult.NUMBER_TYPE : return result.numberValue;
                case XPathResult.BOOLEAN_TYPE: return result.booleanValue;
                case XPathResult.UNORDERED_NODE_ITERATOR_TYPE: {
                    // not ensure the order.
                    var ret = [];
                    var i = null;
                    while (i = result.iterateNext()) {
                        ret.push(i);
                    }
                    return ret;
                }
            }
            return null;
        default:
            throw(TypeError("$X: specified type is not valid type."));
    }
}

// copied from LDR-Prefav (c) id:brazil
function filter(a, f) {
	for (var i = a.length; i --> 0; f(a[i]) || a.splice(i, 1));
}

// copied from Pagerization (c) id:ofk
function parseHTML(str) {
  str = str.replace(/^[\s\S]*?<html(?:\s[^>]+?)?>|<\/html\s*>[\S\s]*$/ig, '');
  var res = document.implementation.createDocument(null, 'html', null);
  var range = document.createRange();
  range.setStartAfter(document.body);
  var fragment = range.createContextualFragment(str);
  try {
    fragment = res.adoptNode(fragment); //for Firefox3 beta4
  } catch (e) {
    fragment = res.importNode(fragment, true);
  }
  res.documentElement.appendChild(fragment);
  return res;
}

function pathToURL(url, path) {
    var s
    if (path.match(/^\//)) { // absolute?
        s = url.replace(/^([a-z]+:\/\/.*?)\/.*$/, '$1')
    } else if ( path.match(/^\?/) ) {
        s = url.replace(/([^#]+?)(\?.*)?(#.*)?$/, '$1')
    } else {
        s = url.replace(/^(.*\/).*$/, '$1')
    }
    return s + path
}

// copied from LDRize (c) id:snj14
function addStyle(css,id){ // GM_addStyle is slow
	var link = document.createElement('link');
	link.rel = 'stylesheet';
	link.href = 'data:text/css,' + escape(css);
	document.documentElement.childNodes[0].appendChild(link);
}

// %o %s %i
function log() {if(console) console.log.apply(console, Array.slice(arguments));}
function group() {if(console) console.group.apply(console, Array.slice(arguments))}
function groupEnd() {if(console) console.groupEnd();}

function time(name) {if(console) console.time.apply(console, [arguments[0]])}
function timeEnd(name) {if(console) console.timeEnd.apply(console, [arguments[0]])}

})(this.unsafeWindow || this);
