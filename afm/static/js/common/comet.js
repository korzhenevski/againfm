// Constructor.
// Based on Dklab_Realplexor
// Create new Comet object.

function Comet(cometUrl)
{
	// Detect current page hostname.
	var host = document.location.host;
	
	// Assign initial properties.
	if (!this.constructor._registry) {
        this.constructor._registry = {};
    }

	this._comet = null;
	this._iframeId = 'mpl' + (new Date().getTime());
	this._iframeTag = 
		'<iframe'
		+ ' id="' + this._iframeId + '"'
		+ ' onload="' + 'Comet' + '._iframeLoaded(&quot;' + this._iframeId + '&quot;)"'
		+ ' src="' + cometUrl + '?host=' + host + '"'
		+ ' style="position:absolute; visibility:hidden; width:1px; height:1px; left:-1000px; top:-1000px"' +
		'></iframe>';
	this._iframeCreated = false;
	this._executeTimer = null;
    this._url = false;
    this._callback = false;
	
	// Register this object in the registry (for IFRAME onload callback).
	this.constructor._registry[this._iframeId] = this;

	// Allow realplexor's IFRAME to access outer window.
	document.domain = host;	
}

// Static function. 
// Called when a realplexor iframe is loaded.
Comet._iframeLoaded = function(id)
{
	var th = this._registry[id];
	// use setTimeout to let IFRAME JavaScript code some time to execute.
	setTimeout(function() {
		var iframe = document.getElementById(id);
		th._comet = iframe.contentWindow.Comet;
	}, 50);
};

Comet._buildUrl = function(params, url) {
    if (!params) return url;
    var parts = [];
    angular.forEach(params, function(value, key) {
        if (value == null || value == undefined) return;
        if (angular.isObject(value)) {
            value = angular.toJson(value);
        }
        parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
    });
    parts = parts.join('&');
    if (url) {
        return url + ((url.indexOf('?') == -1) ? '?' : '&') + parts;
    }
    return parts;
};

Comet.prototype.subscribe = function(url, params, callback) {
    if (angular.isFunction(params) && !callback) {
        callback = params;
        params = null;
    }

    if (params) {
        url = Comet._buildUrl(params, url);
    }

    this._url = url;
    this._callback = callback;
    this.execute();
};

Comet.prototype.unsubscribe = function() {
    this._url = false;
    this._callback = false;
    this.execute();
};

// Reconnect to the server and listen for all specified IDs.
// You should call this method after a number of calls to subscribe().
Comet.prototype.execute = function() {
	// Control IFRAME creation.
	if (!this._iframeCreated) {
		var div = document.createElement('DIV');
		div.innerHTML = this._iframeTag;
		document.body.appendChild(div);
		this._iframeCreated = true;
	}
	
	// Check if the realplexor is ready (if not, schedule later execution).
	if (this._executeTimer) {
		clearTimeout(this._executeTimer);
		this._executeTimer = null;
	}

	var self = this;
	if (!this._comet) {
		this._executeTimer = setTimeout(function() {
            self.execute();
        }, 30);
		return;
	}
	
	// Realplexor loader is ready, run it.
	this._comet.execute(this._url, this._callback);
};


/**
 * Wrapper for angular DI
 */
angular.module('afm.comet', []).provider('comet', function(){
    this.url = '';

    /*
    this.$get = function() {
        return {
            subscribe: function() {},
            unsubscribe: function() {}
        }
    };
    */

    this.$get = function() {
        return new Comet(this.url);
    };

    this.setUrl = function(url) {
        this.url = url;
    };
});
