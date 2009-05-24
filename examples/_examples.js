function onContent(f){//(C)webreflection.blogspot.com
var a,b=navigator.userAgent,d=document,w=window,
c="__onContent__",e="addEventListener",o="opera",r="readyState",
s="<scr".concat("ipt defer src='//:' on",r,"change='if(this.",r,"==\"complete\"){this.parentNode.removeChild(this);",c,"()}'></scr","ipt>");
w[c]=(function(o){return function(){w[c]=function(){};for(a=arguments.callee;!a.done;a.done=1)f(o?o():o)}})(w[c]);
if(d[e])d[e]("DOMContentLoaded",w[c],false);
if(/WebKit|Khtml/i.test(b)||(w[o]&&parseInt(w[o].version())<9))
(function(){/loaded|complete/.test(d[r])?w[c]():setTimeout(arguments.callee,1)})();
else if(/MSIE/i.test(b))d.write(s);
};

if (!Array.prototype.forEach)
{
  Array.prototype.forEach = function(fun /*, thisp*/)
  {
    var len = this.length >>> 0;
    if (typeof fun != "function")
      throw new TypeError();

    var thisp = arguments[1];
    for (var i = 0; i < len; i++)
    {
      if (i in this)
        fun.call(thisp, this[i], i, this);
    }
  };
}
