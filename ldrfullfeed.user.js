// ==UserScript==
// @name        LDR Full Feed
// @namespace   http://d.hatena.ne.jp/Constellation/
// @include     http://reader.livedoor.com/reader/*
// @include     http://fastladder.com/reader/*
// @description loading full entry on LDR and Fastladder
// @version     0.0.19
// @resource    orange  http://github.com/Constellation/ldrfullfeed/tree/master/orange.gif?raw=true
// @resource    blue    http://github.com/Constellation/ldrfullfeed/tree/master/blue.gif?raw=true
// @resource    css     http://github.com/Constellation/ldrfullfeed/tree/master/ldrfullfeed.css?raw=true
// @require     http://gist.github.com/3242.txt
// @author      Constellation
// using [ simple version of $X   ] (c) id:os0x
//       [ relativeToAbsolutePath ] (c) id:Yuichirou
//       [ filter                 ] copied from LDR-Prefav   (c) id:brazil
//       [ parseHTML              ] copied from Pagerization (c) id:ofk
//       [ addStyle               ] copied from LDRize       (c) id:snj14
// thanks
// ==/UserScript==

(function(w){

// == [CSS] =========================================================
const CSS = GM_getResourceText('css');

// == [Config] ======================================================

const VERSION = '0.0.19'

const ICON = 'orange' // or blue

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

const USE_AUTOPAGERIZE_SITEINFO = true;
const AUTOPAGER = true;

const DEBUG = false;

const SITEINFO_IMPORT_URLS = [
{
  name:'Wedata',
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

const AUTOPAGERIZE_SITEINFO_IMPORT_URLS = [
{
  name:'Wedata AutoPagerize',
  format:'JSON',
  url: 'http://wedata.net/databases/AutoPagerize/items.json'
}
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

const AUTOPAGERIZE_MICROFORMAT = {
    name:         'autopagerize_microformat',
    url:          '.*',
    nextLink:     '//a[@rel="next"] | //link[@rel="next"]',
    insertBefore: '//*[contains(@class, "autopagerize_insert_before")]',
    pageElement:  '//*[contains(@class, "autopagerize_page_element")]',
}
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
  log(info, c)
  this.data = c;
  this.info = info;
  this.type = 'FullFeed';

  this.requestURL = this.data.itemURL;
  var bodyXPath = 'id("item_body_' + this.data.id + '")/div[@class="body"]';
  this.data.item_body = $X(bodyXPath, document)[0];
  this.state = 'wait';
  this.mime = 'text/html; charset=' + (this.info.enc || document.characterSet);
  this.entry = [];

  this.request();
};

FullFeed.prototype.request = function(){
  if (!this.requestURL) return;
  this.state = 'request';
  var self = this;
  console.info(this);
  var opt = {
        method: 'get',
        url: this.requestURL,
        overrideMimeType: this.mime,
        headers: {
          'User-Agent': navigator.userAgent + ' Greasemonkey (LDR Full Feed ' + VERSION + ')',
        },
        onerror: function(){
          self.error.call(self, 'FullFeed Request Error');
        },
        onload: function(res){
          self.load.call(self, res)
        },
  };
  message('Loading '+this.type+' ...');
  if(w.hasClass(this.data.container, 'gm_fullfeed_loaded'))
    w.toggleClass(this.data.container, 'gm_fullfeed_loaded');
  w.toggleClass(this.data.container, 'gm_fullfeed_loading');
  window.setTimeout(GM_xmlhttpRequest, 0, opt);
}

FullFeed.prototype.load = function(res){
  this.state = 'loading';
  var text = res.responseText;
  var self = this;

  try {
    text = text.replace(FullFeed.regs.text, "$1");
    if (REMOVE_IFRAME)  text = text.replace(FullFeed.regs.iframe, "");
    var htmldoc = parseHTML(text);
    removeXSSRisk(htmldoc);
    if(res.finalUrl){
      this.requestURL = res.finalUrl;
      relativeToAbsolutePath(htmldoc, this.requestURL);
    } else {
      relativeToAbsolutePath(htmldoc, this.requestURL);
    }
  } catch(e) {
    return this.error('HTML Parse Error');
  }

  time('FULLFEED: DocumentFilterTime: ');
  FullFeed.documentFilters.forEach(function(f) {
    f(htmldoc, this.requestURL, this.info);
  },this);
  timeEnd('FULLFEED: DocumentFilterTime: ');
  this['get'+this.type](htmldoc);
}

FullFeed.prototype.getFullFeed = function(htmldoc){
  this.entry = [];
  if(this.info.microformats){
    log('FULLFEED: Microformats')
    this.entry = getElementsByMicroformats(htmldoc)
  }

  if(this.entry.length == 0){
    try{
      this.entry = $X(this.info.xpath, htmldoc);
    } catch(e) {
      return this.error('Something is wrong with this XPath');
    }
  }

  if(USE_AUTOPAGERIZE_SITEINFO || AUTOPAGER)
    this.apList = Manager.info.autopagerize
      .filter(function({url}){
        return new RegExp(url).test(this.requestURL);
      }, this)
      .sort(function(a, b){ return (b.url.length - a.url.length) });

  if(USE_AUTOPAGERIZE_SITEINFO && this.entry.length == 0){
    log(this.apList)
    this.apList.some(function(i){
      if(i.name=='hAtom' || i.name=='autopagerize_microformat') return false;
      try {
        var entry = $X(i.pageElement, htmldoc);
      } catch(e) { return false }
      if(entry.length>0){
        this.entry = entry;
        log('FULLFEED: AutoPagerize Siteinfo');
        return true;
      }
      else return false;
    },this);
  }

  if(AUTO_SEARCH && this.entry.length == 0){
    log('FULLFEED: Auto Search');
    this.entry = searchEntry(htmldoc);
  }

  if(EXTRACT_TEXT && this.entry.length == 0){
    log('FULLFEED: Extract Text');
    this.entry = extractText(htmldoc);
  }

  this.requestEnd(htmldoc);
}

FullFeed.prototype.getAutoPager = function(htmldoc){
  try {
    this.entry = $X(this.info.xpath, htmldoc);
    (this.entry.length == 0) && (this.entry = $X(this.ap.pageElement, htmldoc));
    this.nextLink = $X(this.ap.nextLink, htmldoc);
  } catch(e) {
    this.enable = false;
  }
  this.requestEnd(htmldoc);
}

FullFeed.prototype.requestEnd = function(htmldoc){
  if (this.entry.length > 0) {
    if(AUTOPAGER) this.searchAutoPagerData(htmldoc);
    log(this.entry);
    time('FULLFEED: FilterTime: ');
    FullFeed.filters.forEach(function(f) { f(this.entry, this.requestURL) }, this);
    timeEnd('FULLFEED: FilterTime: ');

    this.addEntry();
    this.state = 'loaded';
    message('Loading '+this.type+' ...Done');
    if(AUTOPAGER && !FullFeed.fullfeed['_'+this.data.id]) FullFeed.fullfeed['_'+this.data.id] = this;
    w.addClass(this.data.container, 'gm_fullfeed_loaded');
    w.toggleClass(this.data.container, 'gm_fullfeed_loading');
    w.toggleClass(this.data.container, this.requestURL);
  }
  else return this.error('This SITE_INFO is unmatched to this entry');
}

FullFeed.prototype.error = function(e){
  this.state = 'error';
  message('Error: ' + e);
  w.addClass(this.data.container, 'gm_fullfeed_error');
  w.toggleClass(this.data.container, 'gm_fullfeed_loading');
}

FullFeed.prototype.createSpaceFullFeed = function(){
  var range = document.createRange();
  range.selectNodeContents(this.data.item_body);
  range.deleteContents();
  range.detach();
  return document.createDocumentFragment();
}

FullFeed.prototype.createSpaceAutoPager = function(){
  var p = $CF('<hr/><p class="gm_fullfeed_pager">page <a class="gm_fullfeed_link" href="'+this.requestURL+'">'+(++this.pageNum || (this.pageNum=2))+'</a></p>');
  return p;
}

FullFeed.prototype.addEntry = function(){
  var df = this['createSpace'+this.type]();
  this.entry.forEach(function(i){
    try {
      i = document.adoptNode(i, true);
    }catch(e){
      i = document.importNode(i, true);
    }
    df.appendChild(i);
  });
  console.info(this.data.item_body);
  this.data.item_body.appendChild(df);
}

FullFeed.prototype.AutoPager = function (){
  if (!this.enable){
    if(this.pageNum>0) return message("cannot AutoPage");
    else return message('This entry has been already loaded.');
  }
  var nextLink = this.nextLink.getAttribute('href') ||
    this.nextLink.getAttribute('action') ||
    this.nextLink.getAttribute('value');
  var base = this.requestURL;
  nextLink = rel2abs(nextLink, {
    top : base.match(rel2abs.regs.top)[0],
    current : base.replace(rel2abs.regs.current1, '/'),
  });
  this.requestURL = nextLink;
  this.type = 'AutoPager';
  this.request();
}

FullFeed.prototype.searchAutoPagerData = function (htmldoc){
  this.enable = false;
  if(this.apList.length>0){
    var nextLink;
    if(!this.ap){
      if( this.apList.some(function(i){
        if((nextLink = $X(i.nextLink, htmldoc)[0]) &&
          ($X(i.pageElement, htmldoc).length>0)){
            this.ap = i;
            this.enable = true;
            return true;
        }
        return false;
      },this)){
        this.nextLink = nextLink;
      }
    } else {
      if(nextLink = $X(this.ap.nextLink, htmldoc)[0]){
        this.enable = true;
        this.nextLink = nextLink;
      }
    }
  }
}

FullFeed.regs = {
  text: /(<[^>]+?[\s"'])on(?:(?:un)?load|(?:dbl)?click|mouse(?:down|up|over|move|out)|key(?:press|down|up)|focus|blur|submit|reset|select|change)\s*=\s*(?:"(?:\\"|[^"])*"?|'(\\'|[^'])*'?|[^\s>]+(?=[\s>]|<\w))(?=[^>]*?>|<\w|\s*$)/gi,
  iframe: /<iframe(?:\s[^>]+?)?>[\S\s]*?<\/iframe\s*>/gi
}

FullFeed.register = function(){

  if(AUTOPAGER){
    FullFeed.fullfeed = {};
    w.register_hook('BEFORE_PRINTFEED',function(){
      FullFeed.fullfeed = null;
      FullFeed.fullfeed = {};
    });
  }
  if(!WIDGET) return;
  var icon_data = GM_getResourceURL(ICON);
  var description = "\u5168\u6587\u53d6\u5f97\u3067\u304d\u308b\u3088\uff01";
  w.entry_widgets.add('gm_fullfeed_widget', function(feed, item){
    if (Manager.pattern.test(item.link) || Manager.pattern.test(feed.channel.link)) {
      if(CLICKABLE) return [
        '<img class="gm_fullfeed_icon_disable" id="gm_fullfeed_widget_'+item.id+'" src="'+icon_data+'">'
      ].join('');
      else return [
        '<img src="'+icon_data+'">'
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
  var reg = /gm_fullfeed_widget_(\d+)/;
  function getEntryByPressButton (e){
    var id = this.id.match(reg)[1];
    if(this.className && w.hasClass(this, 'gm_fullfeed_icon'))
      Manager.check(id);
  }
}


// API
FullFeed.documentFilters = [];

FullFeed.filters= [];

FullFeed.itemFilters= [];

window.FullFeed = {
  VERSION : VERSION,
  addItemFilter : function(f){ FullFeed.itemFilters.push(f); },
  addFilter : function(f){ FullFeed.filters.push(f); },
  addDocumentFilter : function(f){ FullFeed.documentFilters.push(f); },
};


// [Filters]

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
if(REMOVE_SCRIPT || REMOVE_H2TAG )
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


// [Cache]

var Cache = function(manager){
  var self = this;
  this.manager = manager;
  manager.state = 'loading';
  this.ldrfullfeed  = {};
  this.autopagerize = [AUTOPAGERIZE_MICROFORMAT];
  this.success = 0;
  this.length = SITEINFO_IMPORT_URLS.length+AUTOPAGERIZE_SITEINFO_IMPORT_URLS.length;
  message('Resetting cache. Please wait...');

  PHASE.forEach(function(i){
      this.ldrfullfeed[i.type] = [];
  },this);
  SITEINFO_IMPORT_URLS.forEach(function(obj, index) {
      var name = obj.name || obj.url;
      var opt = {
        method: 'GET',
        url: obj.url,
        headers: {
          'User-Agent': navigator.userAgent + ' Greasemonkey (LDR Full Feed ' + VERSION + ')',
        },
        onload: function(res){
          self.setSiteinfo.call(self, [res, obj, index]);
        },
        onerror: function(res){
          self.error.call(self, 'Cache Request Error'+name);
        },
      }
      window.setTimeout(GM_xmlhttpRequest, 0, opt);
  });
  AUTOPAGERIZE_SITEINFO_IMPORT_URLS.forEach(function(obj, index){
      var name = obj.name || obj.url;
      var opt = {
        method: 'GET',
        url: obj.url,
        headers: {
          'User-Agent': navigator.userAgent + ' Greasemonkey (LDR Full Feed ' + VERSION + ')',
        },
        onload: function(res){
          self.setAutoPagerSiteinfo.call(self, [res, obj, index]);
        },
        onerror: function(res){
          self.error.call(self, 'Cache Request Error'+name);
        },
      }
      window.setTimeout(GM_xmlhttpRequest, 0, opt);
  });
}

Cache.prototype.setSiteinfo = function([res, obj, index]){
  var info = [];
  var name = obj.name || obj.url;
  switch (obj.format.toUpperCase()){
    case 'JSON':
      try {
        info = eval(res.responseText)
          .map(function(i){
            var d = i.data;
            d.name = i.name;
            d.microformats = (d.microformats == 'true');
            d.urlIndex = index;
            return d;
          })
          .filter(function(i){ return (Cache.isValid(i, ['url', 'xpath', 'type'], true)) });
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
        var data = Cache.parseSiteinfo([siteinfo_list.value, index]);
        if (data)
          info.push(data);
      },this);

      var charsets = ['utf-8','euc-jp','shift_jis'];
      charsets.forEach(function(charset){
        $X('//ul[contains(concat(" ",normalize-space(@class)," "), " microformats_list ' + charset + ' ")]/li', doc)
        .forEach(function(microformats_data){
          var data = Cache.parseMicroformats([charset, microformats_data, index]);
          if(data)
            info.push(data);
        },this);
      },this);
      break;
  }
  PHASE.forEach(function(i){
    info.filter(function(d){
          return (d.type.toUpperCase() == i.type
          || (i.sub && d.type.toUpperCase() == i.sub));
        })
        .forEach(function(d){
          this.ldrfullfeed[i.type].push(d);
        }, this);
    this.ldrfullfeed[i.type].sort(function(a,b){
      return a.urlIndex - b.urlIndex;
    });
    log('CACHE: ' + i.type + ':ok');
  }, this);
  if(++this.success == this.length)
    this.requestEnd();
  log('REQUEST END');
}

Cache.prototype.setAutoPagerSiteinfo = function([res, obj, index, id]){
  var info = [];
  var name = obj.name || obj.url;
  try {
    if(Array.reduce){
      info = eval(res.responseText)
        .reduce(function(sum,i){
          var d = i.data;
          d.name = i.name;
          sum.push(d);
          return sum;
        }, []);
    } else {
      info = eval(res.responseText)
        .map(function(sum, i){
          var d = i.data;
          d.name = i.name;
          return d;
        });
    }
  } catch(e) {
    return this.error('Not JSON: '+name);
  }
  info.filter(function(d){
    return Cache.isValid(d);
  })
  .map(function(i){
    this.autopagerize.push(i);
  }, this);
  if(++this.success == this.length)
    this.requestEnd();
}

Cache.prototype.requestEnd = function(){
  this.manager.info = {
    ldrfullfeed  : this.ldrfullfeed,
    autopagerize : this.autopagerize
  };
  GM_setValue('cache', this.manager.info.toSource());
  log(this.manager.info);
  message('Resetting cache. Please wait... Done');
  this.manager.state = 'normal';
  if(WIDGET) this.manager.createPattern();
}

Cache.prototype.error = function(e){
  message('Error: '+e);
  this.manager.state = 'normal';
}

Cache.parseMicroformats = function([c, li, index]){
  if(!li) return;
  var info = {
    name : "MicroformatsURLList:"+li.textContent,
    url : li.textContent,
    urlIndex : index,
    enc : c,
    microformats : true,
    type : 'INDIV_MICROFORMATS'
  }

  return Cache.isValid(info) ? info : null;
}

Cache.parseSiteinfo = function([text, index]){
  var lines = text.split(Cache.regs.line);
  var reg = Cache.regs.reg;
  var trimspace = function(str){
    return str.replace(Cache.regs.space1, '').replace(Cache.regs.space2, '');
  }
  var info = {};
  lines.forEach(function(line) {
    if (reg.test(reg)) {
      info[RegExp.$1] = trimspace(RegExp.$2);
    }
  });

  info.microformats = (info.microformats && info.microformats == 'true');

  return Cache.isValid(info, ['url', 'xpath', 'type'], true) ? info : null;
}
Cache.regs = {
  line: /[\r\n]+/,
  reg: /(^[^:]*?):(.*)$/,
  space1: /^\s*/,
  space2: /\s*$/
};

Cache.isValid = function(info, prop, flag){
  if(prop){
    if (prop.some(function(i){
      if (!info[i]){
        if (i != 'xpath' || (flag || !info.microformats)){
          return true;
        }
      }
    })) return false;
  }
  try{
    var reg = new RegExp(info.url);
  } catch(e) {
    return false;
  }
  return true;
}

// [Manager]
var Manager = {
  info: null,
  pattern: null,
  state: 'normal',

  init: function(){
    var self = this;
    this.getSiteinfo();
    this.rebuildLocalSiteinfo();
    log(this.info);
    if(WIDGET) this.createPattern();
    if(LOADING_MOTION) addStyle(CSS, 'gm_fullfeed_style');
    GM_registerMenuCommand('LDR Full Feed - reset cache', function(){ self.resetSiteinfo.call(self)});
    var id = setTimeout(function() {
      if (id) clearTimeout(id);
      if (typeof w.Keybind != 'undefined' && typeof w.entry_widgets != 'undefined') {
        w.Keybind.add(KEY, function(){
          self.loadCurrentEntry();
        });

        if(GET_ALL)
          w.Keybind.add(GET_ALL_KEY, function(){
            self.loadAllEntries();
          });

        w.Keybind.add(GET_SITEINFO_KEY, function() {
          self.resetSiteinfo();
        });

        if(WIDGET) FullFeed.register();
      } else {
        id = setTimeout(arguments.callee, 100);
      }
    });
  },
  getSiteinfo: function(){
    if(!(this.info = eval(GM_getValue('cache')))){
      var t = {};
      PHASE.forEach(function(i){t[i.type] = []});
      this.info = {
        ldrfullfeed  :  t,
        autopagerize : [AUTOPAGERIZE_MICROFORMAT]
      };
      this.resetSiteinfo();
    }
  },
  resetSiteinfo: function(){
    if(this.state == 'loading') return message('Now loading. Please wait!');
    var cacheAgent = new Cache(this);
  },
  rebuildLocalSiteinfo: function(){
    this.siteinfo = SITE_INFO
      .map(function(i){
        i.urlIndex = -1;
      return i;
    });
  },
  createPattern: function(){
    var exps = [];
    var reg;

    this.siteinfo.forEach(function(i){
      exps.push(i.url);
    });

    for each (var i in this.info.ldrfullfeed) {
      i.forEach(function(info) {
        exps.push(info.url);
      });
    }
    reg = new RegExp (exps.join('|'));
    this.pattern = reg;
  },

  loadCurrentEntry: function(){
    this.check();
  },

  loadAllEntries: function(){
    var items = w.get_active_feed().items;
    if (items && items.length > 0)
    items.forEach(function(item){ this.check(item.id)}, this);
  },

  check: function(id){
    var c = (id) ? new this.getData(id) : new this.getData();
    if(!c) return;
    if(ITEMFILTER){
      FullFeed.itemFilters.forEach(function(f) {
        f(c);
      });
    }

    if(ADCHECKER.test(c.title))
      return message('This entry is advertisement');
    if(w.hasClass(c.container, 'gm_fullfeed_loaded')){
      if(AUTOPAGER && FullFeed.fullfeed['_'+c.id]){
        FullFeed.fullfeed['_'+c.id].AutoPager();
        return;
      }
      else return message('This entry has been already loaded.');
    }
    if(w.hasClass(c.container, 'gm_fullfeed_loading'))
      return message('Now loadig...');

    if(!c.item.fullfeed){
      this.launchFullFeed(this.siteinfo, c);
      log('PHASE: LOCAL SITEINFO');
      if(!c.found && !PHASE.some(function(i){
        log('PHASE: ' + i.type);
        this.launchFullFeed(this.info.ldrfullfeed[i.type], c);
        return c.found;
      }, this)){
        message('This entry is not listed on SITE_INFO');
        if (OPEN) GM_openInTab(c.itemURL) || message('Cannot popup');
      }
    }
  },
  // data format
  //
  //   itemURL
  //   feedURL
  //   id
  //   title
  //   container
  //   title
  //   item           <-- unsafe item
  //   found
  //
  //   create safe item
  getData: function(id){
    if(!id) var id = w.get_active_item(true).id;
    if(!id) return;
    var feed = w.get_active_feed();

    this.item = w.get_item_info(id);
    this.itemURL = this.item.link;
    this.feedURL = feed.channel.link;
    this.id = this.item.id;
    this.container = w.$('item_' + this.id);
    this.title = this.item.title;
    this.found = false;
  },
  launchFullFeed: function(list, c){
    if (typeof list.some != "function") return;
      list.some(function(i) {
        var reg = new RegExp(i.url);
        if (reg.test(c.itemURL) || reg.test(c.feedURL)) {
          c.found = true;
          new FullFeed(i, c);
          return true;
        } else {
          return false;
        }
      });
  }
}

// main
Manager.init();



// == [Utility Functions] ===========================================

function message (mes){
  w.message(mes);
}

function $CF(text){
  return $CF.range.createContextualFragment(text);
}
$CF.range = document.createRange();
$CF.range.selectNode(document.body);

function getElementsByMicroformats (htmldoc) {
  var t;
  MICROFORMATS.some(function(i){
    t = $X(i.xpath, htmldoc)
    if(t.length>0){
      log('FULLFEED: Microformats :' + i.name);
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

function relativeToAbsolutePath(htmldoc, base) {
  var o = {
    top : base.match(rel2abs.regs.top)[0],
    current : base.replace(rel2abs.regs.current1, '/'),
  }

  $X("descendant-or-self::a", htmldoc)
    .forEach(function(elm) {
    if(elm.getAttribute("href")) elm.href = rel2abs(elm.getAttribute("href"), o);
  });
  $X("descendant-or-self::img", htmldoc)
    .forEach(function(elm) {
    if(elm.getAttribute("src")) elm.src = rel2abs(elm.getAttribute("src"), o);
  });
  $X("descendant-or-self::embed", htmldoc)
    .forEach(function(elm) {
    if(elm.getAttribute("src")) elm.src = rel2abs(elm.getAttribute("src"), o);
  });
  $X("descendant-or-self::object", htmldoc)
    .forEach(function(elm) {
    if(elm.getAttribute("data")) elm.data = rel2abs(elm.getAttribute("data"), o);
  });
}

function rel2abs(url, {top, current}) {
  if (url.match(rel2abs.regs.home)) {
    return url;
  } else if (url.indexOf("/") == 0) {
    return top + url;
  } else {
    if(url.indexOf(".") == 0){
      while(url.indexOf(".") == 0){
        if(url.substring(0, 3) == "../")
          current = current.replace(rel2abs.regs.current2,"/");
        url = url.replace(rel2abs.regs.url,"")
      }
    }
    return current + url;
  }
}
rel2abs.regs = {
  top: /^https?:\/\/[^\/]+/,
  home: /^https?:\/\//,
  current1: /\/[^\/]+$/,
  current2: /\/[^\/]+\/$/,
  url: /^\.+\//,

}

function filter(a, f) {
	for (var i = a.length; i --> 0; f(a[i]) || a.splice(i, 1));
}

function parseHTML(str) {
  str = str.replace(parseHTML.reg, '');
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
parseHTML.reg = /^[\s\S]*?<html(?:\s[^>]+?)?>|<\/html\s*>[\S\s]*$/ig;

function addStyle(css,id){ // GM_addStyle is slow
	var link = document.createElement('link');
	link.rel = 'stylesheet';
	link.href = 'data:text/css,' + escape(css);
	document.documentElement.childNodes[0].appendChild(link);
}

// %o %s %i
function log() {if(console && DEBUG) console.log.apply(console, Array.slice(arguments));}
function group() {if(console && DEBUG) console.group.apply(console, Array.slice(arguments))}
function groupEnd() {if(console &&DEBUG) console.groupEnd();}

function time(name) {if(console.time && DEBUG) console.time.apply(console, [arguments[0]])}
function timeEnd(name) {if(console.timeEnd && DEBUG) console.timeEnd.apply(console, [arguments[0]])}

})(this.unsafeWindow || this);
