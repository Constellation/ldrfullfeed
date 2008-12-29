// ==UserScript==
// @name        LDR Full Feed
// @namespace   http://d.hatena.ne.jp/Constellation/
// @include     http://reader.livedoor.com/reader/*
// @include     http://fastladder.com/reader/*
// @description loading full entry on LDR and Fastladder
// @version     0.0.20
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

const VERSION = '0.0.20'

const ICON = 'orange' // or blue

const KEY = 'g';
const GET_SITEINFO_KEY = 'G';
const GET_ALL = true;
const GET_ALL_KEY = 'u';

const ADCHECKER = /(^AD:|^PR:)/;
const LOADING_MOTION = true;

const REMOVE_IFRAME = true;
const DISABLE_HATENAKEYWORD = true;

const OPEN = false; //SITEINFOになかった場合にそのエントリを開くかどうか
const ITEMFILTER = true;
const AUTO_SEARCH = true;
const EXTRACT_TEXT = false;
const WIDGET = true;
const CLICKABLE = true;

const USE_AUTOPAGERIZE_SITEINFO = true;
const AUTOPAGER = true;

const XHR_TIMEOUT = 30 * 1000;
//const XHR_TIMEOUT = 15 * 1000;

const DEBUG = true;

const SITEINFO_IMPORT_URLS = [
{
  name:'Wedata',
  format:'JSON',
  type:'LDRFullFeed',
  url: 'http://wedata.net/databases/LDRFullFeed/items.json',
  alternative: 'http://utatane.appjet.net/databases/LDRFullFeed/items.json'
},
{
  name:'Microformats URL List',
  format:'HTML',
  type:'LDRFullFeed',
  url: 'http://constellation.jottit.com/microformats_url_list'
},

//{format:'HTML', url: 'http://constellation.jottit.com/siteinfo'},
//{format:'HTML', url: 'http://constellation.jottit.com/test'},
];

const AUTOPAGERIZE_SITEINFO_IMPORT_URLS = [
{
  name:'Wedata AutoPagerize',
  format:'JSON',
  type:'AutoPagerize',
  url: 'http://wedata.net/databases/AutoPagerize/items.json',
  alternative: 'http://utatane.appjet.net/databases/AutoPagerize/items.json'
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
    reg:          /.*/,
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

  //time('FULLFEED: DocumentFilterTime: ');
  FullFeed.documentFilters.forEach(function(f) {
    f(htmldoc, this.requestURL, this.info);
  },this);
  //timeEnd('FULLFEED: DocumentFilterTime: ');
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
      .filter(function(obj){
        var url = obj.url;
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
    //time('FULLFEED: FilterTime: ');
    FullFeed.filters.forEach(function(f) { f(this.entry, this.requestURL) }, this);
    //timeEnd('FULLFEED: FilterTime: ');

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
};

FullFeed.register = function(){
  var hasClass = w.hasClass;
  var addClass = w.addClass;
  var removeClass = w.removeClass;

  if(AUTOPAGER){
    FullFeed.fullfeed = {};
    w.register_hook('BEFORE_PRINTFEED',function(){
      FullFeed.fullfeed = {};
    });
  }
  if(!WIDGET) return;
  var icon_data = GM_getResourceURL(ICON);
  var description = "\u5168\u6587\u53d6\u5f97\u3067\u304d\u308b\u3088\uff01";
  w.entry_widgets.add('gm_fullfeed_widget', function(feed, item){
    var pattern = Manager.pattern;
    if((pattern.test(item.link) || pattern.test(feed.channel.link)) && !ADCHECKER.test(item.title)) {
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
    var state = w.State;
    if(!state.writer || state.writer.complete) return;
    watchWriter(feed);
  });
  w.register_hook("BEFORE_PRINTFEED", function(feed){
    removeListener();
  });
  function watchWriter(feed){
    var state = w.State;
    state.writer.watch("complete", function(key, oldVal, newVal){
      state.writer2.watch("complete", function(key, oldVal, newVal){
        if(! state.writer.complete){
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
      removeClass(element, 'gm_fullfeed_icon_disable');
      addClass(element, 'gm_fullfeed_icon');
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
  var reg = /gm_fullfeed_widget_(.+)/;
  function getEntryByPressButton(e){
    var id = this.id.match(reg)[1];
    (this && hasClass(this, 'gm_fullfeed_icon')) && Manager.check(id);
  }
}


// API
FullFeed.documentFilters = [];

FullFeed.filters= [];

FullFeed.itemFilters= [];

window.FullFeed = {
  VERSION: VERSION,
  addItemFilter: function(f){ FullFeed.itemFilters.push(f) },
  addFilter: function(f){ FullFeed.filters.push(f) },
  addDocumentFilter: function(f){ FullFeed.documentFilters.push(f) },
};


// [Filters]

// Filter: Add TargetAttr
window.FullFeed.addFilter(function(nodes, url){
    nodes.forEach(function(e){
      var anchors = $X('descendant-or-self::a', e);
      anchors && anchors.forEach(function(i){ i.target = '_blank' });
    });
});

(function(){
  // Filter: Remove Script and H2 tags
  // iframeはどうも要素を作成した時点で読みにいくようなので、textから正規表現で削除
  // なので、SITEINFOはIFRAMEを基準に作成しないでいただけるとありがたい。
  (function(){
    var h2_span = document.createElement('span');
    h2_span.className = 'gm_fullfeed_h2';
    window.FullFeed.addFilter(function(nodes, url){
      filter(nodes, function(e){
        var n = e.nodeName;
        if(n.indexOf('SCRIPT') == 0) return false;
        if(n.indexOf('H2') == 0) return false;
        return true;
      });
      nodes.forEach(function(e){
        $X('descendant-or-self::*[self::script or self::h2]', e)
        .forEach(function(i){
          var n = i.nodeName;
          var r = h2_span.cloneNode(false);
          if(n == 'SCRIPT') i.parentNode.removeChild(i);
          if(n == 'H2'){
            $A(i.childNodes).forEach(function(child){ r.appendChild(child.cloneNode(true)) });
            i.parentNode.replaceChild(r, i);
          }
        });
      });
    });
  })();
  // Filter: Remove Particular Class
  // LDR 自体が使っているclassを取り除く。とりあえずmoreだけ。
  // ほかにもあれば追加する。
  (function(){
    window.FullFeed.addFilter(function(nodes, url){
      var removeClass = w.removeClass;
      nodes.forEach(function(e){
        $X('descendant-or-self::*[contains(concat(" ",@class," ")," more ")]', e)
        .forEach(function(i){
          removeClass(i, 'more');
        });
      });
    });
  })();
  // Filter: Disable Hatena Keyword
  (function(){
    if(DISABLE_HATENAKEYWORD){
      var reg = /(^http:\/\/d\.hatena\.ne\.jp|^http:\/\/.+?.g\.hatena\.ne\.jp\/bbs|^http:\/\/(.)*?\.g\.hatena.ne\.jp\/|^http:\/\/anond\.hatelabo\.jp\/)/;
      var span = document.createElement('span');
      span.className = 'keyword';
      window.FullFeed.addFilter(function(nodes, url){
        if(!reg.test(url)) return;
        nodes.forEach(function(e){
          var keywords = $X('descendant-or-self::a[(@class="keyword") or (@class="okeyword")]', e);
          if(keywords){
            keywords.forEach(function(key){
              var r = span.cloneNode(false);
              $A(key.childNodes).forEach(function(child){ r.appendChild(child.cloneNode(true)) });
              key.parentNode.replaceChild(r, key);
            });
          }
        });
      });
    }
  })();
})();

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
  }, this);
  SITEINFO_IMPORT_URLS.forEach(function(obj, index) {
    new Agent(obj, this, index);
  }, this);
  AUTOPAGERIZE_SITEINFO_IMPORT_URLS.forEach(function(obj, index){
    new Agent(obj, this, index);
  }, this);
}

Cache.prototype.finalize = function(){
  var manager = this.manager;
  PHASE.forEach(function(p){
    this.ldrfullfeed[p.type].sort(function(a,b){
      return a.urlIndex - b.urlIndex;
    });
  }, this);
  manager.info = {
    VERSION      : VERSION,
    ldrfullfeed  : this.ldrfullfeed,
    autopagerize : this.autopagerize
  };
  GM_setValue('cache', manager.info.toSource());
  log(manager.info);
  message('Resetting cache. Please wait... Done');
  manager.state = 'normal';
  if(WIDGET) manager.createPattern();
  PHASE.forEach(function(i){
    var fullfeed_list = manager.info.ldrfullfeed[i.type];
    fullfeed_list.forEach(function(data){
      data.reg = new RegExp(data.url);
    });
  });
};

Cache.prototype.error = function(e){
  message('Error: '+e);
  this.manager.state = 'normal';
};

var Agent = function(opt, Cache, index){
  for(var i in opt) opt.hasOwnProperty(i) && (this[i] = opt[i]);
  this.Cache = Cache;
  this._flag = false;
  this.index = index;
  Agent.request(this);
}

Agent.prototype = {
  method: 'GET',
  headers: {
    'User-Agent': navigator.userAgent + ' Greasemonkey (LDR Full Feed ' + VERSION + ')'
  },
  onload: function(res){
    this['onload_'+this.type](res);
  },
  onerror: function(code){
    return this.Cache.error(code || 'Cache Request Error '+this.name);
  },
  onload_AutoPagerize: function(res){
    var info = Agent[this.format].AutoPagerize(res.responseText, this.index);
    if(!info) return this.onerror(this.format+' Parse Error: '+this.name);
    var ap_list = this.Cache.autopagerize;
    info.forEach(function(i){
      ap_list.push(i);
    });
    log('REQUEST END');
    if(++this.Cache.success == this.Cache.length) this.Cache.finalize();
  },
  onload_LDRFullFeed: function(res){
    var info = Agent[this.format].LDRFullFeed(res.responseText, this.index);
    if(!info) return this.onerror(this.format+' Parse Error: '+this.name);
    PHASE.forEach(function(i){
      var fullfeed_list = this.Cache.ldrfullfeed[i.type];
      info.filter(function(d){
        var type = d.type.toUpperCase();
        return (type == i.type || (i.sub && type == i.sub));
      })
      .forEach(function(d){
        fullfeed_list.push(d);
      });
      log('CACHE: ' + i.type + ':ok');
    }, this);
    log('REQUEST END');
    if(++this.Cache.success == this.Cache.length) this.Cache.finalize();
  },
  ontimeout: function(){
    log('TIMEOUT');
    if(!this._flag && this.alternative){
      message('Cache Error: TIMEOUT Regain SITEINFO from alternative url');
      this._flag = true;
      this.url = this.alternative;
      Agent.request(this);
    } else {
      this.onerror('Cache Error: TIMEOUT');
    }
  }
};

Agent.JSON = {
  LDRFullFeed: function(data, index){
    try {
      return eval('('+data+')')
      .reduce(function(memo, i){
        var d = i.data;
        d.name = i.name;
        d.microformats = (d.microformats == 'true');
        d.urlIndex = index;
        if(['url', 'xpath', 'type'].some(function(prop){
          if(!d[prop] && (prop != 'xpath' || !d.microformats)) return true;
          try{
            var reg = new RegExp(d.url);
          } catch(e) {
            return true;
          }
          return false;
        })){
          return memo;
        } else {
          memo.push(d);
          return memo;
        }
      }, []);
    } catch(e) {
      return null;
    }
  },
  AutoPagerize: function(data, index){
    var info = [];
    var ap_list = this.autopagerize;
    try {
      if(Array.reduce){
        return eval('('+data+')')
        .reduce(function(memo, i){
          var d = i.data;
          d.name = i.name;
          try{
            var reg = new RegExp(d.url);
            memo.push(d);
            return memo;
          } catch(e) {
            return memo;
          }
        }, []);
      } else {
        return eval('('+data+')')
        .map(function(i){
          var data = i.data;
          data.name = i.name;
          return data;
        });
      }
    } catch(e) {
      return null;
    }
  }
};

Agent.HTML = {
  LDRFullFeed: function(data, index){
    var info = [];
    try {
      var doc = parseHTML(data);
    } catch(e) {
      return null;
    }
    $X('//textarea[contains(concat(" ",normalize-space(@class)," "), " ldrfullfeed_data ")]', doc)
    .forEach(function(siteinfo_list){
      var data = Agent.parseSiteinfo(siteinfo_list.value, index);
      if(data) info.push(data);
    });

    ['utf-8','euc-jp','shift_jis'].forEach(function(charset){
      $X('//ul[contains(concat(" ",normalize-space(@class)," "), " microformats_list ' + charset + ' ")]/li', doc)
      .forEach(function(microformats_data){
        var data = Agent.parseMicroformats(charset, microformats_data, index);
        if(data) info.push(data);
      });
    });
    return info;
  }
};

Agent.parseMicroformats = function(c, li, index){
  if(!li) return;
  var info = {
    name : "MicroformatsURLList:"+li.textContent,
    url : li.textContent,
    urlIndex : index,
    enc : c,
    microformats : true,
    type : 'INDIV_MICROFORMATS'
  }
  try {
    var reg = new RegExp(info.url);
    return info;
  } catch(e) {
    return null;
  }
};

Agent.parseSiteinfo = function(text, index){
  var lines = text.split(Agent.regs.line);
  var reg = Agent.regs.reg;
  var trim = Agent.trim;
  var info = {};
  var result = null;
  lines.forEach(function(line) {
    if(result = line.match(reg)){
      info[result[1]] = trim(result[2]);
    }
  });

  info.microformats = (info.microformats && info.microformats == 'true');
  if(['url', 'xpath', 'type'].some(function(prop){
    if(!info[prop] && (prop != 'xpath' || !info.microformats)) return true;
    try{
      var reg = new RegExp(info.url);
    } catch(e) {
      return true;
    }
    return false;
  })){
    return null;
  } else {
    return info;
  }
};

Agent.trim = function(str){
  return str.replace(Agent.regs.former, '').replace(Agent.regs.latter, '');
};

Agent.regs = {
  line: /[\r\n]+/,
  reg: /(^[^:]*?):(.*)$/,
  former: /^\s*/,
  latter: /\s*$/
};

Agent.request = function(opt){
  var original = opt.onload;
  var new_opt = {
    _timeout_flag: false,
    onload: function(){
      if(new_opt._timeout_flag) return false;
      new_opt._timeout_flag = true;
      if(opt.onload) return opt.onload.apply(opt, arguments);
    },
    onerror: function(){
      if(opt.onerror) return opt.onerror.apply(opt, arguments);
    },
    onreadystatechange: function(){
      if(opt.onreadystatechange) return opt.onreadystatechange.apply(opt, arguments);
    }
  };
  ['headers', 'method', 'url', 'overrideMimeType', 'data']
  .forEach(function(prop){
    new_opt[prop] = opt[prop];
  });
  window.setTimeout(function(){
    if(new_opt._timeout_flag) return;
    new_opt._timeout_flag = true;
    opt.ontimeout.apply(opt, arguments);
  }, opt.time || XHR_TIMEOUT, opt);
  window.setTimeout(GM_xmlhttpRequest, 0, new_opt);
};

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
    var id = setTimeout(function(){
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
    }, 0);
  },
  getSiteinfo: function(){
    var str = GM_getValue('cache', null);
    if(str) this.info = eval(str);
    if(!this.info || !this.info.VERSION || (this.info.VERSION < VERSION)){
      var t = {};
      PHASE.forEach(function(i){t[i.type] = []});
      this.info = {
        ldrfullfeed  :  t,
        autopagerize : [AUTOPAGERIZE_MICROFORMAT],
        VERSION      : VERSION
      };
      this.resetSiteinfo();
    } else {
      PHASE.forEach(function(i){
        var fullfeed_list = this.info.ldrfullfeed[i.type];
        fullfeed_list.forEach(function(data){
          data.reg = new RegExp(data.url);
        });
      }, this);
    }
  },
  resetSiteinfo: function(){
    if(this.state == 'loading') return message('Now loading. Please wait!');
    var cacheAgent = new Cache(this);
  },
  rebuildLocalSiteinfo: function(){
    this.siteinfo = SITE_INFO
      .map(function(data){
        data.urlIndex = -1;
        data.reg = new RegExp(data.url);
      return data;
    });
  },
  createPattern: function(){
    var exps = [];
    this.siteinfo.forEach(function(i){
      exps.push(i.url);
    });
    for each (var i in this.info.ldrfullfeed) {
      i.forEach(function(info) {
        exps.push(info.url);
      });
    }
    this.pattern = new RegExp(exps.join('|'));
  },

  loadCurrentEntry: function(){
    this.check();
  },

  loadAllEntries: function(){
    var items = w.get_active_feed().items;
    if (items && items.length > 0)
    items.forEach(function(item){ this.check(item.id) }, this);
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
      var fullfeed_list = this.info.ldrfullfeed;
      this.launchFullFeed(this.siteinfo, c);
      log('PHASE: LOCAL SITEINFO');
      if(!c.found && !PHASE.some(function(i){
        log('PHASE: ' + i.type);
        this.launchFullFeed(fullfeed_list[i.type], c);
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
    var item_url = c.itemURL;
    var feed_url = c.feedURL;
    list.some(function(data) {
      if (data.reg.test(item_url) || data.reg.test(feed_url)) {
        c.found = true;
        new FullFeed(data, c);
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

function $A(a){
  return Array.prototype.slice.call(a);
}
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

function rel2abs(url, obj) {
  var top = obj.top;
  var current = obj.current;
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
function log() {if(unsafeWindow.console && DEBUG) unsafeWindow.console.log.apply(unsafeWindow.console, Array.slice(arguments));}
function group() {if(unsafeWindow.console && DEBUG) unsafeWindow.console.group.apply(unsafeWindow.console, Array.slice(arguments))}
function groupEnd() {if(unsafeWindow.console &&DEBUG) unsafeWindow.console.groupEnd.apply(unsafeWindow.console, arguments);}

function time(name) {if(unsafeWindow.console.time && DEBUG) unsafeWindow.console.time.apply(unsafeWindow.console, arguments)}
function timeEnd(name) {if(unsafeWindow.console.timeEnd && DEBUG) unsafeWindow.console.timeEnd.apply(console, arguments)}

})(this.unsafeWindow || this);
