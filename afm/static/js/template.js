// Based on ICanHaz (http://github.com/andyet/ICanHaz.js/blob/master/ICanHaz.js)
// This version supports Mustache and Handlebars
// By M@ McCray
;var render = (function($, engine){
  var cache = {},
      methods = {};
  
  $(function(){
    $('script[type="text/html"]').each(function () {
        var name = $(this).attr('id'),
            content = $(this).html();
        if(cache.hasOwnProperty(name)) {
          throw "You've already got a template by the name: \"" + name + "\"";
        }
        cache[name] = engine.compile(content);
        // build the corresponding public retrieval function
        methods[name] = function(data, raw) {
          data = data || {},
          html = engine.render(cache[name], data);
          return (raw) ? html : $(html);
        };
        // remove the element from the dom
        $(this).remove();
    });
  });
  
  return methods;

})(jQuery, (function(){
  if(window.Mustache) {
    return {
      compile: function(s){ return s; },
      render: function(content, data) { return Mustache.to_html(content, data); }
    };
  } else if(window.Handlebars) {
    return {
      compile: function(s) { return Handlebars.compile(s); },
      render: function(template, data) { return template(data); }
    };
  } else {
    throw "You must include Mustache or Handlebars on the page before this script!";
  };
})());

/***
 * Handelbars Template Tags
 */

Handlebars.registerHelper('static_url', function(res) {
  return App.config.static_url + res;
});

Handlebars.registerHelper('user_gravatar_url', function(user) {
    var url = 'http://www.gravatar.com/avatar/'+user.gravatar_hash+'?s=50';
    var avatar_name = (user.sex == 'female') ? 'avatar_female.png' : 'avatar.png';
    url += '&d=' + encodeURIComponent(App.config.full_static_url + 'i/' + avatar_name);
    return url;
});

Handlebars.registerHelper("key_value", function(obj, fn) {
    var buffer = '', key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) {
            buffer += fn({key: key, value: obj[key]});
        }
    }
    return buffer;
});

Handlebars.registerHelper('trans', function(fn) {
    return gettext(fn(this));
});

Handlebars.registerHelper('checkbox', function(option) {
    if (! (option && option.name) ) return;
    var html = '<div class="checkbox" id="'+option.name+'" data-name="'+option.name+'"';
    html += (option.value ? ' data-checked="true"' : '');
    html += '></div>';
    return new Handlebars.SafeString(html);
});

Handlebars.registerHelper('t', function(i18n_key) {
    var res = $.t(i18n_key);
    return new Handlebars.SafeString(res);
});