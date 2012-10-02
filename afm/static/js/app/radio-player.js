App.FlashPlayerEngine = App.View.extend({
    el: '#flash-player',
    ready: false,

    initialize: function(options) {
        // метод вызываемый из флеша, обертка для trigger
        window['flashPlayerCallback'] = _.bind(this.trigger, this);

        // грузим плеер в контейнер, размеры берем из css, минимальная версия - 10
        // контейнер нужен, для разлокировки от всяких ClickToFlash
        var callback = _.bind(this._swfobjectCallback, this);
        swfobject.embedSWF(options.url, this.el.id, this.$el.width(), this.$el.height(), '10', false, {}, {
            "allowScriptAccess": "always",
            'wmode': 'transparent'
        }, {}, callback);

        this.on('all', function(){
           console.log(arguments);
        });

        // событие ready - флеш загрузился и готов к работе
        // контейнер скрывается
        this.on('ready', function(){
            //this.$el.hide();
            this.ready = true;
            //console.log(this.el.loadStream('http://ru.ah.fm/;'));
            //console.log(this.el.playStream());
            console.log(this.el.getVersion());
        })
    },

    _swfobjectCallback: function(res) {
        console.log('swf object ok');
        console.log(arguments);
        if (res.success) {
            this.setElement(res.ref);
        } else {
            this.trigger('exception', 'swfobject load unsuccess');
        }
    },

    checkReady: function() {
        if (!this.ready) {
            this.trigger('exception', 'player not ready');
        }
    },

    load: function(url) {
        this.checkReady();
        this.el.loadStream(url);
    },

    play: function() {
        this.checkReady();
        this.el.playStream();
    }
});

App.Player = function() {
    this.initialize.apply(this, arguments);
}
_.extend(App.Player.prototype, {
    initialize: function() {

    }
});

$(function() {
    App.player = new App.Player();
    App.engine = new App.FlashPlayerEngine({url: '/static/swf/player.swf'});
})