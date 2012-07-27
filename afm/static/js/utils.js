function gettext(text) {
    return text;
}

/**
 * Emulate firebug
 */
(function() {
    var names = 'log debug info warn error assert dir dirxml group groupEnd time timeEnd count trace profile profileEnd'.split(' ');
    var i = names.length;
    window.console = window.console || {};
    while (i--) {
        if (!window.console[names[i]]) {
            window.console[names[i]] = $.noop;
        }
    }
})();

// Django AJAX
$.ajaxSetup({
    beforeSend: function (xhr, settings) {
        xhr.setRequestHeader('X-Timezone-Offset', (new Date()).getTimezoneOffset());
        if (!(/^(GET|HEAD|OPTIONS|TRACE)$/.test(settings.type)) && !(/^https?:.*/.test(settings.url))) {
            xhr.setRequestHeader('X-CSRFToken', $.cookie('csrftoken'));
        }
    }
});

$.getCachedScript = function(url, options) {

  // allow user to set any option except for dataType, cache, and url
  options = $.extend(options || {}, {
    dataType: "script",
    cache: true,
    url: url
  });

  // Use $.ajax() since it is more flexible than $.getScript
  // Return the jqXHR object so we can chain callbacks
  return jQuery.ajax(options);
};

var preloadImage = function() {
    _.each(arguments, function(image_url){
        (new Image()).src = image_url;
    })
}

$.fn.serializeHash = function() {
    var params = {};
    _.each(this.serializeArray(), function(param) {
        params[param.name] = $.trim(param.value);
    });
    return params;
};

$.fn.outerHtml = function() {
    // IE, Chrome & Safari will comply with the non-standard outerHTML, all others (FF) will have a fall-back for cloning
    return (!this.length) ? this : (this[0].outerHTML || (
    function(el) {
        var div = document.createElement('div');
        div.appendChild(el.cloneNode(true));
        var contents = div.innerHTML;
        div = null;
        return contents;
    })(this[0]));
};

$.fn.disable = function() {
    return this.attr('disabled', 'disabled');
}
$.fn.enable = function() {
    return this.removeAttr('disabled');
}

$.fn.placeholder = function() {
    return this.find('input:text,input:password').watermark('', {
        color: '#999',
        left: -3,
        fallback: $.browser.webkit
    });
};

window.requestAnimFrame = (function() {
    return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame ||
    function(/* function */ callback, /* DOMElement */ element) {
        window.setTimeout(callback, 80); // floor 1000 / 20 fps
    };
})();

/*
window.onerror = function(e) {
    console.log(arguments);
    alert(e);
    return true;
};*/
/**
 * Backbone-tastypie.js 0.1
 * (c) 2011 Paul Uithol
 *
 * Backbone-tastypie may be freely distributed under the MIT license.
 * Add or override Backbone.js functionality, for compatibility with django-tastypie.
 */
(function(undefined) {
    Backbone.oldSync = Backbone.sync;
    Backbone.sync = function(method, model, options) {
        if (options.action) {
            if (!options.url) {
                options.url = getValue(model, 'url') || urlError();
            }
            options.url = addSlash(options.url) + options.action;
        }

        return Backbone.oldSync(method, model, options);
    };

    /**
     * Return the first entry in 'data.objects' if it exists and is an array, or else just plain 'data'.
     */
    Backbone.Model.prototype.parse = function(data) {
        return data && data.objects && (_.isArray(data.objects) ? data.objects[0] : data.objects) || data;
    };

    /**
     * Return 'data.objects' if it exists.
     * If present, the 'data.meta' object is assigned to the 'collection.meta' var.
     */
    Backbone.Collection.prototype.parse = function(data) {
        if (data && data.meta) {
            this.meta = data.meta;
        }
        return data && data.objects;
    };

    var addSlash = function(str) {
        return str + ((str.length > 0 && str.charAt(str.length - 1) === '/') ? '' : '/');
    }

    var getValue = function(object, prop) {
        if (!(object && object[prop])) return null;
        return _.isFunction(object[prop]) ? object[prop]() : object[prop];
    };
})();

$.fn.button.defaults.loadingText = gettext('loading...');
